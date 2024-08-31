"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fabric_gateway_1 = require("fabric-gateway");
const multer_1 = __importDefault(require("multer"));
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const fs_2 = require("fs");
const path_1 = require("path");
const promises_2 = __importDefault(require("stream/promises"));
const crypto_1 = require("crypto");
const config = JSON.parse((0, fs_2.readFileSync)((0, path_1.resolve)(__dirname, '../', './config.json'), { encoding: 'utf8' }));
const syncDirPath = (0, path_1.resolve)(__dirname, '../', config.syncDir);
const tmpDirPath = (0, path_1.resolve)(__dirname, '../', 'tmp');
async function computeFileHash(filepath, expectedHash) {
    const input = (0, fs_1.createReadStream)(filepath);
    const hash = (0, crypto_1.createHash)('sha256');
    await promises_2.default.pipeline(input, hash);
    return hash.digest('hex') === expectedHash;
}
const upload = (0, multer_1.default)({ dest: tmpDirPath });
const app = (0, express_1.default)();
const gateway = new fabric_gateway_1.FabricGateway(config.fabric);
console.log(gateway);
app.get('/', (_req, res) => {
    res.sendStatus(200);
});
app.get('/download/:filename', async (_req, res) => {
    const filename = _req.params.filename;
    const filepath = (0, path_1.resolve)(config.syncDir, filename);
    res.download(filepath, err => {
        if (err) {
            res.status(404).send('File not found.');
        }
    });
});
app.post('/upload', upload.single('binary'), async (req, res) => {
    if (!req.file) {
        res.status(400).send('No file uploaded.');
        return;
    }
    const record = await gateway.readRecord(req.body.id);
    const expectedHash = record.Hash;
    const isVerified = await computeFileHash(req.file.path, expectedHash);
    if (isVerified) {
        res.status(200).send(`File uploaded successfully: ${req.file.fieldname} (${req.file.size})`);
        await (0, promises_1.rename)(req.file.path, (0, path_1.resolve)(syncDirPath, req.file.filename));
    }
    else {
        res.status(401).send();
        await (0, promises_1.rm)(req.file.path);
    }
});
app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
});
