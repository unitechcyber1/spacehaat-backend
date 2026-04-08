
import bcrypt from 'bcrypt';

// hash password for reg
export const hashPassword = (password) => {
    return new Promise((resolve, reject) => {
        try {
            bcrypt.hash(password, 10, (err, hashed) => {
                if (err) return resolve(null);
                return resolve(hashed)
            })
        } catch (e) {
            console.log(e)
            resolve(null)
        }
    })
}

export const makePlural = (number, str, sufix) => {
    //to do make it work for ies as well
    if (number > 1) {
        return `${number} ${str}${sufix}`
    } else {
        return `${number} ${str}`
    }
}
