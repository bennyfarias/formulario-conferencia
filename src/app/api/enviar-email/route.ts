import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { emailDestino, nomeTitular, valorTotal } = body;

    if (!emailDestino || !nomeTitular) {
      return NextResponse.json({ error: 'Faltam dados obrigatórios.' }, { status: 400 });
    }

    const mailOptions = {
      from: `"Conferência da Fé Reformada" <${process.env.GMAIL_USER}>`,
      to: emailDestino,
      subject: "Inscrição Confirmada - Conferência da Fé Reformada",
      html: `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #1d4ed8; margin-bottom: 20px;">Sua vaga está garantida! 🎉</h2>
          <p style="font-size: 16px; color: #374151;">Olá, <strong>${nomeTitular}</strong>.</p>
          <p style="font-size: 16px; color: #374151;">Sua inscrição para a Conferência da Fé Reformada está oficialmente confirmada. Recebemos seu pagamento de <strong>R$ ${valorTotal}</strong>.</p>
          <p style="font-size: 16px; color: #374151;">Estamos ansiosos para ver você lá!</p>
          <br/>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 14px; color: #6b7280;">Atenciosamente,</p>
          <p style="font-size: 14px; font-weight: bold; color: #1f2937;">Equipe de Organização - Fé Reformada</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('--- GMAIL ENVIADO ---');
    console.log('Message ID:', info.messageId);

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: any) {
    console.error('ERRO NO GMAIL:', error);
    return NextResponse.json({ 
      error: 'Falha ao enviar e-mail. Verifique a senha de app no .env.local' 
    }, { status: 500 });
  }
}