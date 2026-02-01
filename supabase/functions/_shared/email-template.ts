/**
 * Universelle E-Mail-Vorlage für neurealis ERP
 * Verwendung: import { wrapEmail } from "../_shared/email-template.ts";
 */

export function wrapEmail(betreff: string, inhalt: string): string {
  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${betreff}</title>
<style type="text/css">
    body {
        margin: 0;
        padding: 0;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
        font-family: Arial, sans-serif;
        background-color: #f7f7f7;
    }
    table,
    td {
        border-collapse: collapse !important;
    }
    img {
        border: 0;
        height: auto;
        line-height: 100%;
        outline: none;
        text-decoration: none;
    }
    p {
        display: block;
        margin: 13px 0;
    }
    .footer {
        background-color: #a3a3a3;
        color: #000000;
        padding: 20px 0;
        text-align: center;
        font-size: 14px;
    }
    .footer a {
        color: #000000;
        text-decoration: underline;
    }
    .button-container {
        text-align: center;
        margin: 30px 0;
    }
    .button {
        display: inline-block;
        background-color: red;
        color: white;
        padding: 10px 20px;
        text-decoration: none;
        font-size: 16px;
        font-weight: bold;
        border-radius: 0px;
        border: none;
        cursor: pointer;
    }
    .button:hover {
        background-color: darkred;
    }
    hr {
        width: 80%;
        border: 1px solid #888888;
        margin: 20px auto;
    }
</style>
</head>
<body style="margin:0; padding:0;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
            <td style="padding: 10px 0 30px 0;">
                <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border: 1px solid #cccccc; background-color: #ffffff;">
                    <tr>
                        <td align="center" style="padding: 0;">
                            <img src="https://neurealis.de/wp-content/uploads/2024/07/neurealis20-20Logo20-20Zuschnitt20-20klein1.png" alt="neurealis Logo" width="200" style="display: block; margin: 40px auto;">
                            <img src="https://neurealis.de/wp-content/uploads/2025/03/neurealisKomplettsanierung-header-email_V4.jpg" alt="Header Image" width="600" style="display: block;">
                        </td>
                    </tr>
                    <tr>
                        <td align="left" bgcolor="#a3a3a3" style="padding: 10px 30px 10px 30px;">
                            <h2 style="color: black;">${betreff}</h2>
                        </td>
                    </tr>
                    <tr>
                        <td bgcolor="#ffffff" style="padding: 20px 30px 30px 30px;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td>
${inhalt}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" bgcolor="#a3a3a3" style="background-color: #a3a3a3; color: #000000; padding: 20px 30px; text-align: center; font-size: 14px; font-family: Arial, sans-serif;">
                            neurealis GmbH, Kleyer Weg 40, 44149 Dortmund<br>
                            <a href="tel:023158688560" style="color: #000000; text-decoration: underline;">0231 / 5868 8560</a> | <a href="https://www.neurealis.de" style="color: #000000; text-decoration: underline;">www.neurealis.de</a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}
