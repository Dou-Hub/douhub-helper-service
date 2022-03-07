import { sgSend } from './send-grid';
import { sesSend } from './ses';

export const sendEmail = async (
    service: 'sg'|'ses',
    from: string, 
    to: string[],
    subject: string, 
    htmlMessage: string, 
    textMessage?: string,
    cc?: string[],
    region?: string) => {
    
    switch(service)
    {
        case 'sg': return await sgSend(
            from,
            to, 
            subject,
            htmlMessage,
            textMessage,
            cc,
            region);
        case 'ses': return await sesSend(
            from,
            to, 
            subject,
            htmlMessage,
            textMessage,
            cc,
            region);
    }
}