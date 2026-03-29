const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@imcpalatine.org';
const REGION = process.env.AWS_REGION || 'us-east-1';

const ses = new SESClient({ region: REGION });

const STYLES = {
  wrapper: 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;',
  header: 'background: #1a3a6b; color: #d4a843; padding: 24px 32px; text-align: center;',
  headerTitle: 'margin: 0; font-size: 24px; font-weight: 700; color: #d4a843;',
  headerSub: 'margin: 4px 0 0; font-size: 14px; color: #a8c4e6; font-weight: 400;',
  body: 'padding: 32px;',
  greeting: 'font-size: 16px; color: #333333; margin: 0 0 16px;',
  text: 'font-size: 15px; color: #555555; line-height: 1.6; margin: 0 0 16px;',
  buttonWrap: 'text-align: center; margin: 24px 0;',
  buttonPrimary: 'display: inline-block; background: #1a3a6b; color: #ffffff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-size: 16px; font-weight: 600;',
  buttonAccept: 'display: inline-block; background: #2e7d32; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: 600; margin: 0 8px;',
  buttonDecline: 'display: inline-block; background: #c62828; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: 600; margin: 0 8px;',
  detailBox: 'background: #f5f7fa; border-left: 4px solid #d4a843; padding: 16px 20px; border-radius: 4px; margin: 16px 0;',
  detailLabel: 'font-size: 12px; color: #888888; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;',
  detailValue: 'font-size: 15px; color: #333333; margin: 2px 0 12px; font-weight: 500;',
  footer: 'background: #f5f7fa; padding: 20px 32px; text-align: center; border-top: 1px solid #e0e0e0;',
  footerText: 'font-size: 12px; color: #999999; margin: 0;',
};

function wrapHtml(content) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 20px; background: #f0f2f5;">
  <div style="${STYLES.wrapper}">
    <div style="${STYLES.header}">
      <h1 style="${STYLES.headerTitle}">IMC Palatine</h1>
      <p style="${STYLES.headerSub}">Volunteer Planner</p>
    </div>
    <div style="${STYLES.body}">
      ${content}
    </div>
    <div style="${STYLES.footer}">
      <p style="${STYLES.footerText}">Immaculate Conception Ukrainian Catholic Parish &middot; Palatine, IL</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(to, subject, htmlBody) {
  await ses.send(
    new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
        },
      },
    })
  );
}

async function sendMagicLink(email, magicLinkUrl, orgName) {
  const subject = `Sign in to ${orgName || 'IMC Volunteer Planner'}`;
  const html = wrapHtml(`
    <p style="${STYLES.greeting}">Hello,</p>
    <p style="${STYLES.text}">Click the button below to sign in to the ${orgName || 'IMC'} Volunteer Planner. This link will expire in 15 minutes.</p>
    <div style="${STYLES.buttonWrap}">
      <a href="${magicLinkUrl}" style="${STYLES.buttonPrimary}">Sign In</a>
    </div>
    <p style="${STYLES.text}">If you did not request this link, you can safely ignore this email.</p>
    <p style="font-size: 12px; color: #999999; word-break: break-all;">Or copy this link: ${magicLinkUrl}</p>
  `);
  await sendEmail(email, subject, html);
}

async function sendInvite(email, volunteerName, eventName, shiftTime, locationName, acceptUrl, declineUrl) {
  const subject = `You're invited to volunteer: ${eventName}`;
  const html = wrapHtml(`
    <p style="${STYLES.greeting}">Hello ${volunteerName},</p>
    <p style="${STYLES.text}">You have been invited to volunteer at an upcoming parish event. Please review the details below and let us know if you can participate.</p>
    <div style="${STYLES.detailBox}">
      <p style="${STYLES.detailLabel}">Event</p>
      <p style="${STYLES.detailValue}">${eventName}</p>
      <p style="${STYLES.detailLabel}">Shift</p>
      <p style="${STYLES.detailValue}">${shiftTime}</p>
      <p style="${STYLES.detailLabel}">Location</p>
      <p style="${STYLES.detailValue}">${locationName || 'To be assigned'}</p>
    </div>
    <div style="${STYLES.buttonWrap}">
      <a href="${acceptUrl}" style="${STYLES.buttonAccept}">Accept</a>
      <a href="${declineUrl}" style="${STYLES.buttonDecline}">Decline</a>
    </div>
    <p style="${STYLES.text}">Thank you for your willingness to serve our parish community.</p>
  `);
  await sendEmail(email, subject, html);
}

async function sendReminder(email, volunteerName, eventName, shiftTime, locationName, date) {
  const subject = `Reminder: ${eventName} on ${date}`;
  const html = wrapHtml(`
    <p style="${STYLES.greeting}">Hello ${volunteerName},</p>
    <p style="${STYLES.text}">This is a reminder that you are scheduled to volunteer at an upcoming parish event.</p>
    <div style="${STYLES.detailBox}">
      <p style="${STYLES.detailLabel}">Event</p>
      <p style="${STYLES.detailValue}">${eventName}</p>
      <p style="${STYLES.detailLabel}">Date</p>
      <p style="${STYLES.detailValue}">${date}</p>
      <p style="${STYLES.detailLabel}">Shift</p>
      <p style="${STYLES.detailValue}">${shiftTime}</p>
      <p style="${STYLES.detailLabel}">Location</p>
      <p style="${STYLES.detailValue}">${locationName || 'To be assigned'}</p>
    </div>
    <p style="${STYLES.text}">Thank you for serving our parish community. We look forward to seeing you there.</p>
  `);
  await sendEmail(email, subject, html);
}

module.exports = { sendMagicLink, sendInvite, sendReminder, sendEmail };
