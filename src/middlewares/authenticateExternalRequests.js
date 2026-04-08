import config from '../config';
import crypto from 'crypto';

export default function authenticate(req, res, next) {
            api_key = req.body.api_key;
            api_string = req.body.api_string;
            hash = req.body.hash;
        
        if(!api_string || !hash || !api_key) {
            return res.json({ success: false, message: 'authentication failed' });
        }

        if(api_key !== config.otc_api_key) {
            return res.json({ success: false, message: 'authentication failed' });
        }
        
        const calculatedhash = crypto.createHash('sha256')
                    .update(api_key+api_string)
                    .digest('hex');
        
        if(calculatedhash !== hash ) {
            return res.json({ success: false, message: 'authentication failed' });
        }
    
        return next();
    }