export default `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#4CAF50;">Invoice from SpaceHaat</h2>
  <p>Hi {clientName},</p>
  {customMessageBlock}
  <p>Please find your invoice details below:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:8px;border:1px solid #eee;"><strong>Invoice No.</strong></td><td style="padding:8px;border:1px solid #eee;">{invoiceNumber}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;"><strong>Amount Due</strong></td><td style="padding:8px;border:1px solid #eee;">Rs. {total}</td></tr>
    <tr><td style="padding:8px;border:1px solid #eee;"><strong>Due Date</strong></td><td style="padding:8px;border:1px solid #eee;">{dueDate}</td></tr>
  </table>
  {paymentLinkBlock}
  <p style="font-size:12px;color:#666;">If you have questions, reply to this email or contact info@spacehaat.com.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="font-size:11px;color:#999;">SpaceHaat — Find Your Perfect Space</p>
</div>`;
