//  COPYRIGHT:       PrimeObjects Software Inc. (C) 2021 All Right Reserved
//  COMPANY URL:     https://www.primeobjects.com/
//  CONTACT:         developer@primeobjects.com
//
//  This source is subject to the DouHub License Agreements.
//
//  Our EULAs define the terms of use and license for each DouHub product.
//  Whenever you install a DouHub product or research DouHub source code file, you will be prompted to review and accept the terms of our EULA.
//  If you decline the terms of the EULA, the installation should be aborted and you should remove any and all copies of our products and source code from your computer.
//  If you accept the terms of our EULA, you must abide by all its terms as long as our technologies are being employed within your organization and within your applications.
//
//  THIS CODE AND INFORMATION IS PROVIDED "AS IS" WITHOUT WARRANTY
//  OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING BUT NOT
//  LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
//  FITNESS FOR A PARTICULAR PURPOSE.
//
//  ALL OTHER RIGHTS RESERVED

import _ from './base';
import { getEmailUser } from '../../shared/util/data';

//Send SMS message
export const sendEmail = async (from, to, subject, htmlMessage, textMessage, cc) => {

    if (_.trackLibs) console.log("sendEmail", { data: { from, to, subject, htmlMessage, textMessage, cc }, });
    if (!_.isArray(to)) to = [to];
    to = _.without(_.map(to, (t) => {
        t = getEmailUser(t);
        if (!t) {
            return null;
        }
        else {
            return t;
        }
    }), null);

    if (to.length == 0) console.error('Email recipient sender is not defined.');

    const charset = "UTF-8";

    const params = {
        Destination: { ToAddresses: to },
        Message: {
            Subject: { Charset: charset },
            Body: {},
        },
    };

    params.Message.Subject.Data = subject;

    //HTML Content
    if (_.isNonEmptyString(htmlMessage)) {
        params.Message.Body.Html = { Charset: charset };
        params.Message.Body.Html.Data = htmlMessage;
    }

    //Text Content
    if (_.isNonEmptyString(textMessage)) {
        params.Message.Body.Text = { Charset: charset };
        params.Message.Body.Text.Data = textMessage;
    }

    //Send from
    from = getEmailUser(from, true);
    if (!from) console.error('Email sender is not defined.');
    params.Source = from;

    //CC
    if (_.isArray(cc) && cc.length > 0) {
        params.Destination.CcAddresses = _.map(cc, (t) => {
            t = t.split("|");
            return t.length > 1 ? `${t[0]} <${t[1]}>` : t[0];
        });
    }

    return await _.ses.sendEmail(params).promise();
};

