const https = require('https');

function parseFrom(value) {
  if (!value) {
    return null;
  }

  const match = value.match(/^(.*)<(.+)>$/);
  if (!match) {
    return { email: value.trim() };
  }

  const name = match[1].trim().replace(/^"|"$/g, '');
  const email = match[2].trim();

  return { name: name || undefined, email };
}

function sendBrevoEmail(payload) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('Missing email configuration: BREVO_API_KEY');
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = https.request(
      {
        method: 'POST',
        hostname: 'api.brevo.com',
        path: '/v3/smtp/email',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': apiKey,
          'content-length': Buffer.byteLength(body),
        },
        timeout: 15000,
      },
      (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve(data);
            return;
          }

          const error = new Error('Brevo API request failed');
          error.statusCode = response.statusCode;
          error.response = data;
          reject(error);
        });
      }
    );

    request.on('error', (error) => reject(error));
    request.on('timeout', () => {
      request.destroy(new Error('Brevo API request timed out'));
    });

    request.write(body);
    request.end();
  });
}

async function sendOtpEmail(email, otp, name) {
  const from = parseFrom(process.env.EMAIL_FROM) || { email: process.env.BREVO_SENDER_EMAIL || process.env.BREVO_SMTP_USER };

  try {
    await sendBrevoEmail({
      sender: from,
      to: [{ email, name }],
      subject: 'Echoes of CUET - Verify your account',
      textContent: `Hello ${name},\n\nYour verification OTP is: ${otp}\n\nThis code is required to complete your registration.`,
      htmlContent: `<p>Hello ${name},</p><p>Your verification OTP is: <strong>${otp}</strong></p><p>This code is required to complete your registration.</p>`,
    });
    console.log('OTP email sent to:', email);
  } catch (error) {
    console.error('OTP email failed:', {
      code: error.code,
      statusCode: error.statusCode,
      response: error.response,
      message: error.message,
    });
    throw error;
  }
}

module.exports = {
  sendOtpEmail,
};
