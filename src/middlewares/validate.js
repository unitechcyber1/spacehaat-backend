  /*
        Apply validation dynamically.
        This function has been designed keeping format of validationsRules.js (utilities) in mind.
    */
  import validationRules from '../utilities/validationRules';
  let {
      rules,
      accStepMap
  } = require('../utilities/constants.js');
  let models = require('../models');
  let Logger = require('../utilities/logger');

  export default async function validate(req, res, next) {
      //skip get requests
      let loggingInfo = {
          body: JSON.stringify(req.body),
          url: req.url,
          method: req.method
      }
      Logger.info(JSON.stringify(loggingInfo));

      //for sikiping api written for exchange
      if (req.url.includes('/api/olegacy')) return next()
      if (req.method === 'GET' || req.method === 'OPTIONS') return next();
      const b = req.body;
      const urlPathArr = req.path.split('/');
      const formType = urlPathArr[2];
      let formAbout = urlPathArr[3];
      // for accesing values in resgistration
      if (!accStepMap[formAbout]) return next();
      if (accStepMap[formAbout] && accStepMap[formAbout]['similarTo']) {
          req.formAbout = accStepMap[formAbout]['similarTo'];
      } else {
          req.formAbout = formAbout
      }


      // no explation why in req.body not in req. Aise hi !!
      req.body.shouldRegisterOnBlockChain = accStepMap[formAbout]['shouldRegisterOnBlockChain'];
      let formData;
      // for api's which have multiple forms 
      let {
          step
      } = req.body;
      if (!step) {
          formData = validationRules[formType][formAbout]
      } else {
          formData = validationRules[formType][accStepMap[req.formAbout][step]['func']];
      }
      for (let key in formData) {
          if (!accStepMap[formAbout]['shouldRegisterOnBlockChain'] && ['storage_type', 'public_key'].includes(key)) continue;
          if (req.body.toUpdate && !req.body.toSendEmail && (key === "email" || key === "public_key")) continue;
          if (formData[key].constructor === Object) {
              for (let i = 0; i < b[key].length; i++) {
                  for (let nested in formData[key]) {
                      let isValid = await checkField(formData[key][nested], b[key][i], nested)
                      if (isValid !== 'valid') {
                          return res.json(setFailureResponse(isValid))
                      }
                  }

              }
          } else {
              let isValid = await checkField(formData[key], b, key)
              if (isValid !== 'valid') {
                  return res.json(setFailureResponse(isValid))
              }
          }
      }
      next()
  }
  async function checkField(formDataKey, b, key) {
      for (let i = 0; i < formDataKey.length; i++) {
          let rule = formDataKey[i];
          let ruleProperty;
          if (rule.constructor === Array) {
              ruleProperty = rule[1];
              rule = rule[0];
          }
          switch (rule) {
              case 'required':
                  {
                      if (!b.hasOwnProperty(key) || (!b[key] && b[key] !== 0) || b[key].toString().trim() === '') {
                          return `${key} is required`
                      }
                      break;
                  }
              case 'alfa':
                  {
                      if (b[key] && b[key].toString().trim() !== '' && !rules.alphabet.regex.test(b[key].toString().trim())) {
                          return `${key} should contain alphabets only`
                      }
                      break;
                  }
              case 'alfa-num':
                  {
                      if (!b[key] || !rules.alphanumeric.regex.test(b[key].toString().trim())) {
                          return `${key} should not contain symbols`
                      }
                      break;
                  }
              case 'email':
                  {
                      if (!b[key] || !rules.email.regex.test(b[key].toString().trim())) {
                          return `Invalid ${key} `
                      }
                      break;
                  }
              case 'num':
                  {
                      if ((!b[key] && b[key] !== 0) || !rules.numeric.regex.test(b[key].toString().trim())) {
                          return `Invalid ${key} `
                      }
                      break;
                  }
              case 'float':
                  {
                      if ((!b[key] && b[key] !== 0) || parseFloat(b[key]) === NaN) {
                          return `Invalid ${key} `
                      }
                      break;
                  }
              case 'unique':
                  {
                      let where = {
                          [key]: b[key]
                      };
                      if (b['user_id']) {
                          if (b['step'] === 2) {
                              where['id'] = {
                                  $ne: b['user_id']
                              }
                          } else {
                              where['user_id'] = {
                                  $ne: b['user_id']
                              }
                          }
                      }
                      let data = await models[ruleProperty].findOne({
                          where
                      })
                      if (data && Object.keys(data).length > 0) {
                          return `${key} already exists`
                      }
                      break;
                  }
              case 'len-max':
                  {
                      if (!b[key] || b[key].length > +ruleProperty) {
                          return `Max length allowed for ${key} is ${+ruleProperty} `
                      }
                      break;
                  }
              case 'value-in':
                  {
                      if (!b[key] || !ruleProperty.includes(b[key].toString().trim())) {
                          return `Invalid ${key}`
                      }
                      break;
                  }

              case 'len-min':
                  {

                      if (!b[key] || b[key].length < +ruleProperty) {
                          return `Min length allowed for ${key} is ${+ruleProperty} `
                      }
                      break;
                  }

              case 'val-max':
                  {
                      if (!b[key] || b[key] > +ruleProperty) {
                          return `Max value allowed for ${key} is ${+ruleProperty} `
                      }
                      break;
                  }
              case 'val-min':
                  {
                      if (!b[key] || b[key] < +ruleProperty) {
                          return `Min value allowed for ${key} is ${+ruleProperty} `
                      }
                      break;
                  }

          }
      }
      return "valid"
  }
  let setFailureResponse = function (err) {
      let apiResponse = {
          "code": 400,
          "message": "Bad Request or Internal Server Error. Please see data for inner exception.",
          "err": err.toUpperCase()
      }
      return apiResponse;
  }

  //key_storage
  //local or server
  // public_key