import aws from 'aws-sdk';
import storage from "../config/storage.js";
import mail from "../config/mail.js"
import _ from 'lodash';
import emailTemplates from './emailTemplate.js';
const API_VERSION = '2016-11-15';
const charset = 'UTF-8';
import multer from 'multer';
import multerS3 from 'multer-s3';

class AWS {
    constructor() {
        aws.config.update({
            accessKeyId: storage.s3.key,
            secretAccessKey: storage.s3.secret,
            region: storage.s3.region
        });
        return {
            S3Upload: this.S3Upload.bind(this),
            S3Delete: this.S3Delete.bind(this),
            sendMail: this.sendMail.bind(this)
        }
    }



    async S3Upload(fileParams) {
        try {
            let s3 = new aws.S3();
            return await s3.upload(fileParams).promise();
        } catch (e) {
            throw (e)
        }

    }

    async S3Delete(fileParams) {
        try {
            let s3 = new aws.S3();
            return s3.deleteObject(fileParams).promise();
        } catch (e) {
            throw (e)
        }
    }

    async sendMail({ toEmails, templateName, htmlVariables, subjectVariables, bccAddresses, ccAddresses }) {
        try {
            const ses = new aws.SES({ apiVersion: API_VERSION });
            const { html, subject } = emailTemplates.getTemplate(templateName, htmlVariables, subjectVariables);
            const params = {
                Destination: {
                    BccAddresses: bccAddresses,
                    CcAddresses: ccAddresses,
                    ToAddresses: toEmails
                },
                Message: {
                    Body: {
                        Html: {
                            Data: html,
                            Charset: charset
                        }
                    },
                    Subject: {
                        Data: subject,
                        Charset: charset
                    }
                },
                Source: mail.source,
                // ConfigurationSetName: 'STRING_VALUE',
                // ReplyToAddresses: [
                // // 'STRING_VALUE',
                // /* more items */
                // ],
                // ReturnPath: '',
                // ReturnPathArn: '',
                // SourceArn: '',
                Tags: [{
                    Name: 'Tetsing',
                    Value: 'Testing'
                }, ]
            };
            ses.sendEmail(params, (err, data) => {
                /*
                just update emailStatus collection with message id and status
                rest is saved in reference with user ids
                !!!!!!!!!!!!!!!!!!
                think about sending bulk averstisement email
                reason we will only have emails on user or admin ids
                */
                if (err) {
                    console.log(err);
                } else {
                    console.log(data);
                }
            });
        } catch (e) {
            console.log(e)
        }
    }
}

export default new AWS();