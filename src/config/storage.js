const storage = {
    defaultStorage: process.env.DEFAULT_STORAGE || 's3',
    local: {
        path: {
            image: 'files/images',
            document: 'files/documents'
        }
    },
    s3: {
        /** S3 bucket name only (no path). Keys are built as `${prefix}/${fileName}`. */
        bucket: process.env.AWS_S3_BUCKET || 'spacehaat-bucket',
        key: process.env.AWS_ACCESS_KEY,
        secret: process.env.AWS_SECRET_KEY,
        storageClass: process.env.AWS_STORAGE_CLASS || 'STANDARD',
        path: {
            image: 'spacehaat-bucket/images',
            document: 'files/documents'
        },
        region: process.env.AWS_REGION || 'ap-south-1'
    },
    maxFileSize: 20 * 1024 * 1024
};

export default storage;