import { SES } from 'aws-sdk';
import { isNil, isArray, without, map } from 'lodash';
import { _process, _track, isNonEmptyString } from 'douhub-helper-util';

export const getSES = (region?: string) => {
    if (!region) region = _process.env.REGION;
    if (!region) region = 'us-east-1';

    if (isNil(_process._ses)) _process._ses = {};
    if (!_process._ses[region]) _process._ses[region] = new SES({ region });
    return _process._ses[region];
}

//from 
export const sesSend = async (
    from: string, 
    to: string[],
    subject: string, 
    htmlMessage: string, 
    textMessage?: string,
    cc?: string[],
    region?: string) => {
    try {

        const charset = "UTF-8";
        const params: Record<string, any> = {
            Destination: {
                ToAddresses: map(to, (t: string) => {
                    const tinfo = t.split("|");
                    return tinfo.length > 1 ? `${tinfo[1]} <${tinfo[0]}>` : tinfo[0];
                })
            },
            Message: {
                Subject: { Charset: charset },
                Body: {},
            },
        };

        params.Message.Subject.Data = subject;

        //HTML Content
        if (isNonEmptyString(htmlMessage)) {
            params.Message.Body.Html = { Charset: charset };
            params.Message.Body.Html.Data = htmlMessage;
        }

        //Text Content
        if (isNonEmptyString(textMessage)) {
            params.Message.Body.Text = { Charset: charset };
            params.Message.Body.Text.Data = textMessage;
        }

        //Send from
        const finfo = from.split("|");
        params.Source = finfo.length > 1 ? `${finfo[1]} <${finfo[0]}>` : finfo[0];

        //CC
        if (isArray(cc) && cc.length > 0) {
            params.Destination.CcAddresses = map(cc, (c: string) => {
                const cinfo = c.split("|");
                return cinfo.length > 1 ? `${cinfo[1]} <${cinfo[0]}>` : cinfo[0];
            });
        }

        return await (getSES(region)).sendEmail(params).promise();

    }
    catch (error: any) {
        if (_track) console.error({ source: 'sesSend', error, from, to, 
        subject, htmlMessage, textMessage,  cc, region});
        throw error;
    }
};