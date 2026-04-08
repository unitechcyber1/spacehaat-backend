const storage = {
    defaultStorage: process.env.DEFAULT_STORAGE || 's3',
    local: {
        path: {
            image: 'files/images',
            document: 'files/documents'
        }
    },
    s3: {
        key: process.env.AWS_ACCESS_KEY,
        secret: process.env.AWS_SECRET_KEY,
        storageClass: process.env.AWS_STORAGE_CLASS || 'STANDARD',
        path: {
            image: 'cofynd-staging/images',
            document: 'files/documents'
        },
        region: 'ap-south-1'
    },
    maxFileSize: 20 * 1024 * 1024
};

export default storage;