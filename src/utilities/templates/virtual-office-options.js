export default `
<!DOCTYPE html
    PUBLIC "-//W3C//DTD XHTML 1.0 Transitional //EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">

<html xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:v="urn:schemas-microsoft-com:vml">

<head>
    <!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
    <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
    <meta content="width=device-width" name="viewport" />
    <!--[if !mso]><!-->
    <meta content="IE=edge" http-equiv="X-UA-Compatible" />
    <meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
    <!--<![endif]-->
    <title></title>
    <!--[if !mso]><!-->
    <!--<![endif]-->
    <style type="text/css">
        .calender-img-box span {
            display: inline-block;
            vertical-align: middle;
        }

        body {
            margin: 0;
            padding: 0;
            font-family: helvatica, arial, helvatica-neue, sans-serif;
        }

        table,
        td,
        tr {
            vertical-align: top;
            border-collapse: collapse;
        }

        * {
            line-height: inherit;
            box-sizing: border-box;
            -ms-box-sizing: border-box;
            -webkit-box-sizing: border-box;
        }

        a[x-apple-data-detectors=true] {
            color: inherit !important;
            text-decoration: none !important;
        }
            a[x-apple-data-detectors],
u + #body a,
#MessageViewBody a {
  color: inherit !important;
  text-decoration: none !important;
  font-size: inherit !important;
  font-family: inherit !important;
  font-weight: inherit !important;
}

/* Prevent address auto-detection on mobile devices */
.location-text,
span.location-text,
.location-text a,
span.location-text a,
.location-text span,
.location-text span a,
[class*="location-text"] a,
[class*="location-text"] span a {
  color: #212121 !important;
  text-decoration: none !important;
  pointer-events: none !important;
  cursor: default !important;
  -webkit-touch-callout: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  user-select: none !important;
}

/* Override any auto-detected links within location blocks */
.location-text a[href],
span.location-text a[href],
.location-text span a[href] {
  color: #212121 !important;
  text-decoration: none !important;
  pointer-events: none !important;
  cursor: default !important;
}

/* Prevent iOS Mail auto-detection */
a[x-apple-data-detectors="false"],
span[x-apple-data-detectors="false"] {
  color: #212121 !important;
  text-decoration: none !important;
  pointer-events: none !important;
}

.location-text {
  color:#212121 !important;
  text-decoration:none !important;
  pointer-events:none;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

/* Prevent iOS Mail from auto-detecting addresses */
a[x-apple-data-detectors="true"].location-text,
a[x-apple-data-detectors].location-text {
  color: #212121 !important;
  text-decoration: none !important;
  font-size: inherit !important;
  font-family: inherit !important;
  font-weight: inherit !important;
  pointer-events: none !important;
  cursor: default !important;
}


        .ie-browser table {
            table-layout: fixed;
        }

        [owa] .img-container div,
        [owa] .img-container button {
            display: block !important;
        }

        [owa] .fullwidth button {
            width: 100% !important;
        }

        [owa] .block-grid .col {
            display: table-cell;
            float: none !important;
            vertical-align: top;
        }

        .ie-browser .block-grid,
        .ie-browser .num12,
        [owa] .num12,
        [owa] .block-grid {
            width: 600px !important;
        }

        .ie-browser .mixed-two-up .num4,
        [owa] .mixed-two-up .num4 {
            width: 224px !important;
        }

        .ie-browser .mixed-two-up .num8,
        [owa] .mixed-two-up .num8 {
            width: 448px !important;
        }

        .ie-browser .block-grid.two-up .col,
        [owa] .block-grid.two-up .col {
            width: 336px !important;
        }

        .ie-browser .block-grid.three-up .col,
        [owa] .block-grid.three-up .col {
            width: 336px !important;
        }

        .ie-browser .block-grid.four-up .col [owa] .block-grid.four-up .col {
            width: 168px !important;
        }

        .ie-browser .block-grid.five-up .col [owa] .block-grid.five-up .col {
            width: 136px !important;
        }

        .ie-browser .block-grid.six-up .col,
        [owa] .block-grid.six-up .col {
            width: 113px !important;
        }

        .ie-browser .block-grid.seven-up .col,
        [owa] .block-grid.seven-up .col {
            width: 97px !important;
        }

        .ie-browser .block-grid.eight-up .col,
        [owa] .block-grid.eight-up .col {
            width: 85px !important;
        }

        .ie-browser .block-grid.nine-up .col,
        [owa] .block-grid.nine-up .col {
            width: 75px !important;
        }

        .ie-browser .block-grid.ten-up .col,
        [owa] .block-grid.ten-up .col {
            width: 60px !important;
        }

        .ie-browser .block-grid.eleven-up .col,
        [owa] .block-grid.eleven-up .col {
            width: 54px !important;
        }

        .ie-browser .block-grid.twelve-up .col,
        [owa] .block-grid.twelve-up .col {
            width: 50px !important;
        }
    </style>
    <style id="media-query" type="text/css">
        @media only screen and (min-width: 700px) {

            .block-grid {
                width: 620px !important;
            }

            .block-grid .col {
                vertical-align: top;
            }

            .block-grid .col.num12 {
                width: 600px !important;
            }

            .block-grid.mixed-two-up .col.num3 {
                width: 168px !important;
            }

            .block-grid.mixed-two-up .col.num4 {
                width: 224px !important;
            }

            .block-grid.mixed-two-up .col.num8 {
                width: 448px !important;
            }

            .block-grid.mixed-two-up .col.num9 {
                width: 504px !important;
            }

            .block-grid.two-up .col {
                width: 340px !important;
            }

            .block-grid.three-up .col {
                width: 226px !important;
            }

            .block-grid.four-up .col {
                width: 170px !important;
            }

            .block-grid.five-up .col {
                width: 136px !important;
            }

            .block-grid.six-up .col {
                width: 113px !important;
            }

            .block-grid.seven-up .col {
                width: 97px !important;
            }

            .block-grid.eight-up .col {
                width: 85px !important;
            }

            .block-grid.nine-up .col {
                width: 75px !important;
            }

            .block-grid.ten-up .col {
                width: 68px !important;
            }

            .block-grid.eleven-up .col {
                width: 61px !important;
            }

            .block-grid.twelve-up .col {
                width: 56px !important;
            }
        }

        @media (max-width: 700px) {
            .visit-cancelled-box {
                display: block;
            }

            .onboard-img-box {
                padding: 30px !important;
            }

            .visit-cancelled-box p {
                font-size: 16px !important;
            }

            .onboard-img-box.device-top {
                padding-top: 30px !important;
            }

            .calender-img-box {
                display: block;
                width: 100%;
                margin: 0 !important;
                margin-right: 15px !important;
            }

            .block-grid,
            .col {
                min-width: 320px !important;
                max-width: 100% !important;
                display: block !important;
            }

            .block-grid {
                width: 100% !important;
            }

            .col {
                width: 100% !important;
            }

            .col>div {
                margin: 0 auto;
            }

            img.fullwidth,
            img.fullwidthOnMobile {
                max-width: 100% !important;
            }


            .custom-social {

                margin-top: 10px !important;

            }

            .custom-width-box {
                width: 100% !important;
                float: left !important;
                text-align: left !important;
                margin-bottom: 0 !important;
            }

            .onboard-img-box.box-on-device {
                padding: 0 !important;
            }

            .onboard-img-box .process-img {
                padding: 0 30px !important;
            }

            .onboard-img-box .name-tag {
                font-size: 16px !important;
            }

            .onboard-img-box.footer-pattern {
                padding-top: 30px !important;
            }

            .calender-img-box .download-app {
                font-size: 12px !important;
            }

            .things-box {
                font-size: 16px !important;
                margin: 15px 0px 5px !important;
            }
        }
    </style>
</head>

<body class="clean-body" style="margin: 0; padding: 0; -webkit-text-size-adjust: 100%; background-color: #fff;">
    <style id="media-query-bodytag" type="text/css">
        @media (max-width: 700px) {
            .terms-policy {
                display: block !important;
                width: 100% !important;
            }

            .block-grid {
                min-width: 320px !important;
                max-width: 100% !important;
                width: 100% !important;
                display: block !important;
            }

            .col {
                min-width: 320px !important;
                max-width: 100% !important;
                width: 100% !important;
                display: block !important;
            }

            .col>div {
                margin: 0 auto;
            }

            img.fullwidth {
                max-width: 100% !important;
                height: auto !important;
            }

            img.fullwidthOnMobile {
                max-width: 100% !important;
                height: auto !important;
            }

        }
    </style>
    <!--[if IE]><div class="ie-browser"><![endif]-->
    <table bgcolor="#fff" cellpadding="0" cellspacing="0" class="nl-container" role="presentation"
        style="table-layout: fixed; vertical-align: top; min-width: 320px; Margin: 0 auto; border-spacing: 0; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #fff; width: 100%;"
        valign="top" width="100%">
        <tbody>
            <tr style="vertical-align: top;" valign="top">
                <td style="word-break: break-word; vertical-align: top; border-collapse: collapse;" valign="top">
                    </div>
                    <div style="background-color:#fff;">
                        <div class="block-grid two-up"
                            style="Margin: 0 auto; min-width: 320px; max-width: 620px; overflow-wrap: break-word; word-wrap: break-word; word-break: break-word; background-color: transparent;;">
                            <div
                                style="border-collapse: collapse;display: table;width: 100%;background-color:transparent;">
                                <!--[if (mso)|(IE)]><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff;"><tr><td align="center"><table cellpadding="0" cellspacing="0" border="0" style="width:620px"><tr class="layout-full-width" style="background-color:transparent"><![endif]-->
                                <!--[if (mso)|(IE)]><td align="center" width="340" style="background-color:transparent;width:340px; border-top: 0px solid transparent; border-left: 0px solid transparent; border-bottom: 0px solid transparent; border-right: 0px solid transparent;" valign="top"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right: 0px; padding-left: 0px; padding-top:5px; padding-bottom:5px;"><![endif]-->
                                <div class="col num6"
                                    style="min-width: 320px; max-width: 340px; display: table-cell; vertical-align: top;;">
                                    <div style="width:100% !important;">
                                        <!--[if (!mso)&(!IE)]><!-->
                                        <div
                                            style="border-top:0px solid transparent; border-left:0px solid transparent; border-bottom:0px solid transparent; border-right:0px solid transparent; padding-top:35px; padding-bottom:0; padding-right: 0px; padding-left: 0px;">
                                            <!--<![endif]-->
                                            <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right: 10px; padding-left: 10px; padding-top: 5px; padding-bottom: 10px; font-family: Arial, sans-serif"><![endif]-->
                                            <div
                                                style="color:#28404F;font-family:Arial, 'Helvetica Neue', Helvetica, sans-serif;padding:0;">

                                            </div>
                                            <!--[if mso]></td></tr></table><![endif]-->
                                            <!--[if (!mso)&(!IE)]><!-->
                                        </div>
                                        <!--<![endif]-->
                                    </div>
                                </div>
                                <!--[if (mso)|(IE)]></td></tr></table><![endif]-->
                                <!--[if (mso)|(IE)]></td></tr></table></td></tr></table><![endif]-->
                            </div>
                        </div>
                    </div>



                    <div style="background-color:#fff;">
                        <div class="block-grid"
                            style="Margin: 0 auto; min-width: 320px; max-width: 620px; overflow-wrap: break-word; word-wrap: break-word; word-break: break-word; background-color: transparent;;">
                            <div
                                style="border-collapse: collapse;display: table;width: 100%;background-color:transparent;">
                                <!--[if (mso)|(IE)]><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff;"><tr><td align="center"><table cellpadding="0" cellspacing="0" border="0" style="width:620px"><tr class="layout-full-width" style="background-color:transparent"><![endif]-->
                                <!--[if (mso)|(IE)]><td align="center" width="620" style="background-color:transparent;width:620px; border-top: 0px solid transparent; border-left: 0px solid transparent; border-bottom: 0px solid transparent; border-right: 0px solid transparent;" valign="top"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right: 0px; padding-left: 0px; padding-top:5px; padding-bottom:5px;"><![endif]-->
                                <div class="col num12"
                                    style="min-width: 320px; max-width: 620px; display: table-cell; vertical-align: top;;">
                                    <div style="width:100% !important;">
                                        <!-- <div
                                            style="font-size: 12px; line-height: 16px; text-align:center;border:1px solid #ebebeb;padding:0;border-bottom:none;border-top:none;">
                                            <img style="max-width:100%;"
                                                src="https://img.cofynd.com/images/latest_images_2024/9e0b4fa4238a0a1715a55d93f28c8d91e1ec8968.webp"
                                                alt="Banner" />
                                        </div> -->
                                        <div class="onboard-img-box"
                                            style="margin-bottom:0;border:1px solid #ebebeb;padding:30px;border-radius: 0;border-bottom:none;">


                                            <p class="name-tag"
                                                style="font-size:22px;font-weight:400;letter-spacing:0;color:#000;margin:0 0 15px;line-height:25px">
                                                <b>Dear {name},</b>
                                            </p>

                                            <p
                                                style="font-size:14px;font-weight:400;letter-spacing:0.2px;color:#212121;margin:15px 0 12px;line-height:20px;">
                                                Thank you for showing interest in a <strong>Virtual Office in {city}</strong>.
                                            </p>

                                            <p
                                                style="font-size:14px;font-weight:400;letter-spacing:0.2px;color:#212121;margin:15px 0 12px;line-height:20px;">
                                                If you're looking for a government-compliant address for GST, MCA incorporation, bank account opening, or statutory registrations, we can help you get it done smoothly — without delays or rejections.
                                            </p>

                                            <p style="font-size:14px;font-weight:bold;margin:20px 0 10px;color:#000;">
                                                ✔ 100% Accepted For
                                            </p>
                                            <ul style="font-size:14px;line-height:22px;color:#212121;margin:0 0 15px;padding-left:20px;">
                                                <li>GST Registration & Verification</li>
                                                <li>Company Incorporation (MCA)</li>
                                                <li>Registrar of Companies (Pvt Ltd, LLP, Partnership, Sole Proprietorship)</li>
                                                <li>Business Current Account Opening</li>
                                                <li>PAN, TAN & Professional Tax Registrations</li>
                                            </ul>
                                            <p style="font-size:14px;line-height:20px;color:#212121;margin:0 0 20px;">
                                                All documentation are legally valid and ready for submission.
                                            </p>

                                            <p style="font-size:14px;font-weight:bold;margin:20px 0 10px;color:#000;">
                                                📦 What You Receive in the Plan
                                            </p>
                                            <p style="font-size:14px;line-height:20px;color:#212121;margin:0 0 10px;">
                                                You'll get a complete document kit, including:
                                            </p>
                                            <ul style="font-size:14px;line-height:22px;color:#212121;margin:0 0 20px;padding-left:20px;">
                                                <li>Notarised / Registered Service Agreement</li>
                                                <li>NOC (No Objection Certificate)</li>
                                                <li>Electricity Bill</li>
                                                <li>Internet Bill</li>
                                                <li>(Additional documents available if required by department)</li>
                                            </ul>

                                            <p style="font-size:14px;font-weight:bold;margin:20px 0 10px;color:#000;">
                                                📍 Available Prime Locations – {city}
                                            </p>
                                            <div style="color:#212121;" x-apple-data-detectors="false">
                                                {location_blocks}
                                            </div>
                                            <p style="font-size:14px;line-height:20px;color:#212121;margin:15px 0;">
                                                Prices are annual. GST 18% applicable.<br>
                                                10% savings available on 2-year bookings.
                                            </p>
                                            <p style="font-size:14px;font-weight:bold;color:#212121;margin:15px 0 20px;">
                                                Limited Slots Available – Due to high demand, slots at premium locations fill quickly. We recommend locking your preferred address at the earliest.
                                            </p>

                                            <p style="font-size:14px;font-weight:bold;margin:20px 0 10px;color:#000;">
                                                💼 Why Clients Choose Us
                                            </p>
                                            <ul style="font-size:14px;line-height:22px;color:#212121;margin:0 0 20px;padding-left:20px;">
                                                <li>Prestigious business address in prime locations</li>
                                                <li>Use address on website, visiting cards & Google Business Profile</li>
                                                <li>Mail & courier handling with notifications</li>
                                                <li>Support for bank account opening</li>
                                                <li>Fully remote process — no physical visit required</li>
                                            </ul>

                                            <p style="font-size:14px;font-weight:bold;margin:20px 0 10px;color:#000;">
                                                Lets Get Started (3 simple steps)
                                            </p>
                                            <p style="font-size:14px;line-height:20px;color:#212121;margin:0 0 10px;">
                                                1️⃣ Share required documents<br>
                                                2️⃣ Make the payment using payment gateway <a href="https://pages.razorpay.com/pl_PLtJ9BuJaz26N9/view" style="color:#027FFF;text-decoration:none;font-weight:bold;">Click Here to Pay</a> or use the details below:
                                            </p>

                                            <p style="font-size:14px;font-weight:bold;margin-top:15px;color:#000;">Bank Details:</p>
                                            <p style="font-size:14px;line-height:20px;color:#212121;margin:0 0 15px;">
                                                Account Name: COFYND INFOTECH PVT LTD<br>
                                                Account Number: 244705001101<br>
                                                IFSC Code: ICIC0002447<br>
                                                Branch: Malibu Towne
                                            </p>

                                            <p style="font-size:14px;font-weight:bold;margin-top:15px;color:#000;">Documents Required:</p>
                                            <ul style="font-size:14px;line-height:22px;color:#212121;margin:0 0 15px;padding-left:20px;">
                                                <li>Authorized Person Name, Email & Contact</li>
                                                <li>Business Activity Details</li>
                                                <li>MCA Registration Letter</li>
                                                <li>GST Number (if available)</li>
                                                <li>Company Name Approval Letter (if available)</li>
                                                <li>Authorized Signatory ID & Address Proof (Aadhar & PAN)</li>
                                            </ul>

                                            <p style="font-size:14px;line-height:20px;color:#212121;margin:15px 0 20px;">
                                                3️⃣ Receive complete documentation package ready for submission: Once payment is confirmed, we dispatch your documents ready for submission to GST, MCA or your bank.<br>
                                                If you'd like, we can also help you choose the most suitable location based on your business type, call us now for best guidance on booking Virtual Office.
                                            </p>

                                            <p style="font-size:14px;margin-top:20px;color:#212121;">
                                                Best Regards,<br><br>
                                                <strong>Vikash Agrawal</strong><br>
                                                Sr. Sales Partner – Virtual Office<br>
                                                📞 <a href="tel:+919311328043" style="color:#027FFF;text-decoration:none;font-weight:bold;">9311328043</a>, <a href="tel:+919311328049" style="color:#027FFF;text-decoration:none;font-weight:bold;">9311328049</a><br>
                                                ✉ <a href="mailto:accounts@cofynd.com" style="color:#027FFF;text-decoration:none;font-weight:bold;">accounts@cofynd.com</a>
                                            </p>

                                        </div>
                                        <div class="onboard-img-box footer-pattern"
                                            style="background-image:url(https://ci3.googleusercontent.com/proxy/g6kG0XV85IeFEZ9Pl5Tmom7Y1HNMu2XKACYMEg8wyRIaeF9JxHxQsmFxXzSRPLrfb96SPsWGkCCHp-AZOnLVFptdmg4CZDwU3dHr6dZqD7wUs-3izrhGqpHSF3tdjQ=s0-d-e1-ft#https://cofynd-staging.s3.ap-south-1.amazonaws.com/mailer/bottom-banner.png);background-repeat:no-repeat;background-position:center bottom;margin-bottom:0;text-align:center;color:#886600;border:1px solid #ebebeb;border-top:none;padding: 30px 50px;border-radius: 0;">
                                            <div class="custom-social" style="margin:0;width: 100%;">
                                                <a href="javascript:void(0)"><span
                                                        style="margin:0 3px;width:30px;height:30px;max-height:30px;border:1px solid #886600;display:inline-block;text-align:center;padding:7px 0 0;vertical-align:middle;border-radius:30px;"><img
                                                            style="max-width:7px;width:7px;height:15px;"
                                                            src="https://ci6.googleusercontent.com/proxy/GQDQMhf94NJuTAKI4Wwg1fCwUYz4vDYm8D5rLNJmQ_OkM0PcvxT7q8pWiDlEoyqtTlN8bAw5bRYo79eaZ-MxNLRie6GiSG_uKUQDzI3mK_XNZd2pmYpIPlg=s0-d-e1-ft#https://cofynd-staging.s3.ap-south-1.amazonaws.com/mailer/facebook.png"></span></a>
                                                <a href="javascript:void(0)"><span
                                                        style="margin:0 3px;width:30px;height:30px;max-height:30px;border:1px solid #886600;display:inline-block;text-align:center;padding:6px 0 0;vertical-align:middle;border-radius:30px;"><img
                                                            style="max-width:13px;width:13px;height:11px;"
                                                            src="https://ci4.googleusercontent.com/proxy/HVixWVZd8fVwJarBzAUMoSAgfYPacxwFcHcTXFCfiaIypaUIrv0rHYNS5JGZdXJm-b5vvCfQo2by4VWbTRdYHeMLAZB8jQPBQJ5CEW-YJjU5JEUZcOO0XQ=s0-d-e1-ft#https://cofynd-staging.s3.ap-south-1.amazonaws.com/mailer/twitter.png"></span></a>
                                                <a href="javascript:void(0)"><span
                                                        style="margin:0 3px;width:30px;height:30px;max-height:30px;border:1px solid #886600;display:inline-block;text-align:center;padding:6px 0 0;vertical-align:middle;border-radius:30px;"><img
                                                            style="max-width:12px;width:12px;height:12px;"
                                                            src="https://ci4.googleusercontent.com/proxy/IAeN9ct58HMYRKtFApTjB5CKOWznTwE4ReOT-vDT1Nhmi_vx58P6PdBPORcvKWOMJdRr4vzvBVqmn-ztNUgcxPlz2dEbGL3mg0Dj_ZF3e5V6sa4ZwyQTKwTY=s0-d-e1-ft#https://cofynd-staging.s3.ap-south-1.amazonaws.com/mailer/instagram.png"></span></a>
                                                <a href="javascript:void(0)"><span
                                                        style="margin:0 3px;width:30px;height:30px;max-height:30px;border:1px solid #886600;display:inline-block;text-align:center;padding:7px 0 0;vertical-align:middle;border-radius:30px;"><img
                                                            style="max-width:14px;width:14px;height:15px;"
                                                            src="https://ci6.googleusercontent.com/proxy/b26LjC4CgDZRDz8Ksu_w-6MvUDzLuXRTciT2ie4lWrh6sjIak0C2-8YkWuTNUzNe2jR4DpA45QBlmttB1c8cgWG8EfDU6K3RaAQnwNmsMM5ojoPVLB8=s0-d-e1-ft#https://cofynd-staging.s3.ap-south-1.amazonaws.com/mailer/gplus.png"></span></a>
                                            </div>
                                            <div style="font-size:9px;color:#886600;margin:10px 0 5px;">
                                                If you don’t want to receive this mail in the future.<br />
                                                Please click <a href="#"
                                                    style="text-decoration:underline;font-size:9px;color:#886600;font-weight:bold;">here</a>
                                                to unsubscribe.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        </tbody>
    </table>
    <!--[if (IE)]></div><![endif]-->
</body>

</html>
`