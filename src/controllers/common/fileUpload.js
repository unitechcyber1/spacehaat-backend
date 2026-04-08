import FileUtility from '../../utilities/file.js';
import models from '../../models/index.js';
import crypto from 'crypto';
const Image = models['Image'];
class FileUpload {
    constructor() {
        return {
            uploadFile: this.uploadFile.bind(this),
            deleteFile: this.deleteFile.bind(this),
            updateImage: this.updateImage.bind(this),
            findFolderFromPath: this.findFolderFromPath.bind(this)
        }
    }

    async _getName() {
        return crypto.randomBytes(20).toString('hex');
    }
    async uploadFile(req, res, next) {
        try {
            const { file } = req.files;
            const { type, contrast, brightness } = req.body;
            let name = await this._getName();
            let fileDetails = await FileUtility.saveFile({ file }, type, name, contrast, brightness);
            let fileData = null;
            if (type === 'document') {
                filedata = fileDetails;
            } else {
                fileDetails = [fileDetails];
                await FileUtility.saveFile({ file }, type, name, 'cofynd-staging/small/images/latest_images_2024', true, 497, 280);
                // await FileUtility.saveFile({ file }, type, name, 'medium', true, 1080, 720);
                // await FileUtility.saveFile({ file }, type, name, 'large', true, 1440, 960);
                fileData = await Image.insertMany(fileDetails);
            }
            return res.json({ success: true, message: "Uploaded", data: fileData });
        } catch (error) {
            next(error);
        }
    }
    
    async updateImage(req, res, next) {
        try {
            const { _id, title, title1, brightness, contrast } = req.body;
            await Image.updateOne({ _id }, { $set: { title, title1, brightness, contrast } });
            return res.json({ success: true, message: "Uploaded", data: null });
        } catch (error) {
            next(error);
        }
    }
    
    async deleteFile(req, res, next) {
        try {
            const { id, s3_link, name } = req.body;
            let fileDetails = await Image.deleteOne({ _id: id });
            if (s3_link) {
                let imageFolderName = s3_link.split('/');
                imageFolderName = imageFolderName[imageFolderName.length - 2];
                fileDetails = await FileUtility.deleteFile(name, imageFolderName);
            }
            return res.json({ success: true, message: "deleted", data: fileDetails });
        } catch (error) {
            next(error);
        }
    }

    findFolderFromPath(s3_link) {
        let imageFolderName = s3_link.split('/');
        return imageFolderName[imageFolderName.length - 2];
    }
}

export default new FileUpload();