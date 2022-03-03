const sgMail = require('@sendgrid/mail');
import { isNonEmptyString, _track, _process } from 'douhub-helper-util';
import { getSecretValue } from './secret-manager';
import { map, isArray } from 'lodash';

export const getSendGrid = async () => {
    if (_process._sendGrid) return _process._sendGrid;
    _process._sendGrid = sgMail;
    _process._sendGrid.setApiKey(await getSecretValue('SEND_GRID'));
    return _process._sendGrid;
};

//from 
export const sendGridSend = async (
    from: string, to: string[],
    subject: string, htmlMessage:
        string, textMessage?: string,
    cc?: string[],
    region?: string) => {
    try {

        const charset = "UTF-8";
        const params: Record<string, any> = {
            to: map(to, (t: string) => {
                const tinfo = t.split("|");
                return tinfo.length > 1 ? `${tinfo[0]} <${tinfo[1]}>` : tinfo[0];
            }),
            Message: {
                Subject: { Charset: charset },
                Body: {},
            },
        };

        params.subject = subject;

        //HTML Content
        if (isNonEmptyString(htmlMessage)) {
            params.html = htmlMessage;
        }

        //Text Content
        if (isNonEmptyString(textMessage)) {
            params.text = textMessage;
        }

        //Send from
        const finfo = from.split("|");
        params.from = finfo.length > 1 ? `${finfo[0]} <${finfo[1]}>` : finfo[0];

        //CC
        if (isArray(cc) && cc.length > 0) {
            params.cc = map(cc, (c: string) => {
                const cinfo = c.split("|");
                return cinfo.length > 1 ? `${cinfo[0]} <${cinfo[1]}>` : cinfo[0];
            });
        }

        console.log({params});

        return (await getSendGrid()).send(params);

    }
    catch (error: any) {
        if (_track) console.error({
            source: 'sendGridSend', error, from, to,
            subject, htmlMessage, textMessage, cc, region
        });
        throw error;
    }
};