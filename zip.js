/* Minimal zip writer (supports only the subset used by Skin Studio) */
var zip = (function () {
    function utf8encode(str) {
        var utf8 = [];
        for (var i = 0; i < str.length; i++) {
            var charcode = str.charCodeAt(i);
            if (charcode < 0x80) utf8.push(charcode);
            else if (charcode < 0x800) {
                utf8.push(0xc0 | (charcode >> 6));
                utf8.push(0x80 | (charcode & 0x3f));
            } else if (charcode < 0xd800 || charcode >= 0xe000) {
                utf8.push(0xe0 | (charcode >> 12));
                utf8.push(0x80 | ((charcode >> 6) & 0x3f));
                utf8.push(0x80 | (charcode & 0x3f));
            } else {
                i++;
                charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
                utf8.push(0xf0 | (charcode >> 18));
                utf8.push(0x80 | ((charcode >> 12) & 0x3f));
                utf8.push(0x80 | ((charcode >> 6) & 0x3f));
                utf8.push(0x80 | (charcode & 0x3f));
            }
        }
        return new Uint8Array(utf8);
    }

    function crc32(bytes) {
        var table = zip._crcTable;
        if (!table) {
            table = zip._crcTable = new Uint32Array(256);
            for (var n = 0; n < 256; n++) {
                var c = n;
                for (var k = 0; k < 8; k++) {
                    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                }
                table[n] = c >>> 0;
            }
        }
        var crc = 0 ^ (-1);
        for (var i = 0; i < bytes.length; i++)
            crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
        return (crc ^ (-1)) >>> 0;
    }

    function writeUInt32LE(buf, offset, value) {
        buf[offset] = value & 0xFF;
        buf[offset + 1] = (value >>> 8) & 0xFF;
        buf[offset + 2] = (value >>> 16) & 0xFF;
        buf[offset + 3] = (value >>> 24) & 0xFF;
    }

    function writeUInt16LE(buf, offset, value) {
        buf[offset] = value & 0xFF;
        buf[offset + 1] = (value >>> 8) & 0xFF;
    }

    function BlobWriter(type) {
        this.type = type || "application/octet-stream";
        this.parts = [];
    }
    BlobWriter.prototype.write = function (data) {
        this.parts.push(data);
    };
    BlobWriter.prototype.getBlob = function () {
        return new Blob(this.parts, { type: this.type });
    };

    function TextReader(text) {
        this.text = text;
    }
    TextReader.prototype.getData = function (cb) {
        cb(utf8encode(this.text));
    };

    function Data64URIReader(dataURI) {
        this.dataURI = dataURI;
    }
    Data64URIReader.prototype.getData = function (cb) {
        if (!this.dataURI) {
            cb(new Uint8Array(0));
            return;
        }
        var commaIndex = this.dataURI.indexOf(",");
        var base64 = this.dataURI.substring(commaIndex + 1);
        var binary = atob(base64);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++)
            bytes[i] = binary.charCodeAt(i);
        cb(bytes);
    };

    function createWriter(writer, cb, errorCb) {
        var entries = [];
        var totalSize = 0;

        function add(name, reader, done) {
            reader.getData((data) => {
                var nameBytes = utf8encode(name);
                var crc = crc32(data);
                entries.push({
                    name,
                    nameBytes,
                    data,
                    crc,
                    offset: totalSize
                });

                totalSize += 30 + nameBytes.length + data.length;

                done();
            });
        }

        function close(done) {
            var centralDirSize = 0;
            for (var i = 0; i < entries.length; i++) {
                var e = entries[i];
                centralDirSize += 46 + e.nameBytes.length;
            }
            var totalLength = totalSize + centralDirSize + 22;
            var buf = new Uint8Array(totalLength);
            var offset = 0;
            // write file entries
            for (var i = 0; i < entries.length; i++) {
                var e = entries[i];
                writeUInt32LE(buf, offset, 0x04034b50); // local file header sig
                writeUInt16LE(buf, offset + 4, 20);
                writeUInt16LE(buf, offset + 6, 0);
                writeUInt16LE(buf, offset + 8, 0); // no compression
                writeUInt16LE(buf, offset + 10, 0);
                writeUInt16LE(buf, offset + 12, 0);
                writeUInt32LE(buf, offset + 14, e.crc);
                writeUInt32LE(buf, offset + 18, e.data.length);
                writeUInt32LE(buf, offset + 22, e.data.length);
                writeUInt16LE(buf, offset + 26, e.nameBytes.length);
                writeUInt16LE(buf, offset + 28, 0);
                offset += 30;
                buf.set(e.nameBytes, offset);
                offset += e.nameBytes.length;
                buf.set(e.data, offset);
                offset += e.data.length;
            }
            var centralOffset = offset;
            for (var i = 0; i < entries.length; i++) {
                var e = entries[i];
                writeUInt32LE(buf, offset, 0x02014b50); // central file header sig
                writeUInt16LE(buf, offset + 4, 20);       // version made by
                writeUInt16LE(buf, offset + 6, 20);       // version needed
                writeUInt16LE(buf, offset + 8, 0);        // flags
                writeUInt16LE(buf, offset + 10, 0);       // compression
                writeUInt16LE(buf, offset + 12, 0);       // mod time
                writeUInt16LE(buf, offset + 14, 0);       // mod date
                writeUInt32LE(buf, offset + 16, e.crc);
                writeUInt32LE(buf, offset + 20, e.data.length);
                writeUInt32LE(buf, offset + 24, e.data.length);
                writeUInt16LE(buf, offset + 28, e.nameBytes.length);
                writeUInt16LE(buf, offset + 30, 0);       // extra
                writeUInt16LE(buf, offset + 32, 0);       // comment
                writeUInt16LE(buf, offset + 34, 0);       // disk number
                writeUInt16LE(buf, offset + 36, 0);       // internal attrs
                writeUInt32LE(buf, offset + 38, 0);       // external attrs (MISSING BEFORE)
                writeUInt32LE(buf, offset + 42, e.offset);

                offset += 46; // not 42
                buf.set(e.nameBytes, offset);
                offset += e.nameBytes.length;
            }

            // end of central directory record
            writeUInt32LE(buf, offset, 0x06054b50);
            writeUInt16LE(buf, offset + 4, 0);
            writeUInt16LE(buf, offset + 6, 0);
            writeUInt16LE(buf, offset + 8, entries.length);
            writeUInt16LE(buf, offset + 10, entries.length);
            writeUInt32LE(buf, offset + 12, centralDirSize);
            writeUInt32LE(buf, offset + 16, centralOffset);
            writeUInt16LE(buf, offset + 20, 0);

            // actually use the buffer we just built
            if (writer.write) {
                writer.write(buf);
            }
            var blob = writer.getBlob
                ? writer.getBlob()
                : new Blob([buf], { type: writer.type || "application/zip" });

            done(blob);
        }

        setTimeout(() => cb({ add, close }), 0);
        return { add: add, close: close };
    }

    return { BlobWriter, TextReader, Data64URIReader, createWriter };
})();
