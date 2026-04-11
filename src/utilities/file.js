import app from "../config/app.js";
import storage from "../config/storage.js";
import {fileTypeFromBuffer} from 'file-type';
import fs from "fs/promises"; // Use fs/promises for promise-based fs functions
import AWS from './aws.js';
import sharp from 'sharp';

class File {
    constructor() {
        return {
            saveFile: this.saveFile.bind(this),
            deleteFile: this.deleteFile.bind(this)
        };
    }

    getExtension(filename) {
        return filename.split('.').pop();
    }

    async _checkExtension(buffer) {
        // check extension from magic hex 
        // input file buffer
        try {
            return await fileTypeFromBuffer(buffer);
        } catch (e) {
            throw (e);
        }
    }
    _normalizeKeyPrefix(prefix) {
        if (!prefix || typeof prefix !== 'string') {
            return 'images';
        }
        return prefix.replace(/^\/+|\/+$/g, '');
    }

    async _getS3Params(key, body, keyPrefix) {
        const prefix = this._normalizeKeyPrefix(keyPrefix);
        return {
            Key: `${prefix}/${key}`,
            Body: body,
            StorageClass: storage.s3.storageClass,
            Bucket: storage.s3.bucket,
            ContentType: 'image/webp',
        };
    }
     convertS3ToCloudFront(originalUrl) {
        const s3Domain = `${storage.s3.bucket}.s3.${storage.s3.region}.amazonaws.com`;
        const cloudFrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
        const convertedUrl = cloudFrontDomain
            ? originalUrl.replace(s3Domain, cloudFrontDomain)
            : originalUrl;
      
        return convertedUrl;
      }
    async saveFile({ file }, type, name, imageFolderName = 'images', resize = true, width = 1000, height = 550, brightness = 1, contrast = 1) {
        try {
            let uploadedFile = null;
            let path = null;
            let ext;
            let convertedUrl
            let { name: realName, size, data } = file;
            if(realName === 'logo.png'){
                resize = false
            }
            if (await this._checkExtension(data)) {
                ext = (await this._checkExtension(data)).ext;
            } else {
                ext = this.getExtension(file.name);
            }
           
            ext = ext.toLowerCase(); // Convert to lowercase for case-insensitive comparison
            if (!app.allowedExtensions.includes(ext)) {
                throw new Error("Bad extension");
            }

            if (storage.defaultStorage === 'local' || type === 'document') {
                // to do for local storage
                path = type === 'document' ? storage.local.path.document : storage.local.path.image;
                uploadedFile = await this._localFileUploadHandler(data, path, name);
                convertedUrl = this.convertS3ToCloudFront(uploadedFile.Location);
            } else {
                if (resize) {
                    data = await this._resize(data, { width, height });
                }
                const fileParams = await this._getS3Params(`${name}.webp`, data, imageFolderName);
                uploadedFile = await AWS.S3Upload(fileParams);
                convertedUrl = this.convertS3ToCloudFront(uploadedFile.Location);
            }
            return {
                name: `${name}.${ext}`,
                real_name: realName,
                path_local: type === 'document' ? `${path}/${uploadedFile}` : '',
                s3_link: uploadedFile ? convertedUrl : '',
                size: size,
                height: height,
                width: width,
                brightness: brightness,
                contrast: contrast
            };
        } catch (e) {
            throw (e);
        }
    }
   

    async deleteFile(Key, imageFolderName) {
        try {
            const prefix = this._normalizeKeyPrefix(imageFolderName);
            const objectKey = prefix ? `${prefix}/${Key}` : Key;
            await AWS.S3Delete({ Key: objectKey, Bucket: storage.s3.bucket });
            // await AWS.S3Delete({ Key, Bucket: `${storage.s3.path.image}/large` });
            // await AWS.S3Delete({ Key, Bucket: `${storage.s3.path.image}/medium` });
            // await AWS.S3Delete({ Key, Bucket: `cofynd-staging/small/images/latest_images_2024`});
            return true;
        } catch (error) {
            throw (error);
        }
    }

    async _localFileUploadHandler(data, path, randomName) {
        const ext = (await this._checkExtension(data)).ext;

        ext = ext.toLowerCase(); // Convert to lowercase for case-insensitive comparison

        if (!app.allowedExtensions.includes(ext)) {
            throw new Error("Bad extension");
        }

        if (!(await fs.exists(path))) {
            const paths = path.split('/');
            for (let index = 0; index < paths.length; index++) {
                let element = null;
                if (index === 0) {
                    element = paths[index];
                } else {
                    element = `${paths[0]}/${paths[index]}`;
                }
                if (!(await fs.exists(element))) {
                    await fs.mkdir(element);
                }
            }
        }
        await fs.writeFile(`${path}/${randomName}.${ext}`, data);
        return `${randomName}.${ext}`;
    }

    async  _resize(data, params, format) {
        try {
            return await sharp(data)
            .resize({
                width: params.width,
                height: params.height,
                fit: 'inside', // Maintain aspect ratio, fit the resized image within the specified dimensions
                withoutEnlargement: true // Do not enlarge the image if smaller than the specified dimensions
            })
            .jpeg({ quality: 80 }) // You can adjust quality settings as needed
            .toBuffer();
        } catch (e) {
          throw e;
        }
      }
}

export default new File();
