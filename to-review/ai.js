//  COPYRIGHT:       PrimeObjects Software Inc. (C) 2021 All Right Reserved
//  COMPANY URL:     https://www.primeobjects.com/
//  CONTACT:         developer@primeobjects.com
// 
//  This source is subject to the PrimeObjects License Agreements. 
// 
//  Our EULAs define the terms of use and license for each PrimeObjects product. 
//  Whenever you install a PrimeObjects product or research PrimeObjects source code file, you will be prompted to review and accept the terms of our EULA. 
//  If you decline the terms of the EULA, the installation should be aborted and you should remove any and all copies of our products and source code from your computer. 
//  If you accept the terms of our EULA, you must abide by all its terms as long as our technologies are being employed within your organization and within your applications.
// 
//  THIS CODE AND INFORMATION IS PROVIDED "AS IS" WITHOUT WARRANTY
//  OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING BUT NOT
//  LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
//  FITNESS FOR A PARTICULAR PURPOSE.
// 
//  ALL OTHER RIGHTS RESERVED

import _ from '../util/base';
import { v4 } from 'uuid';
import axios from 'axios';
import qs from 'qs';

export const translate = async (content, from, to) => {
    const key = await _.getSecretValue('AZURE_TRANSLATOR');
    const options = {
        method: 'post',
        url: `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${from}&to=${to}`,
        headers: {
            'Ocp-Apim-Subscription-Key': key,
            'content-type': 'application/json',
            'X-ClientTraceId': v4()
        },
        data: [{ text: content }]
    };

    return await axios.request(options);
};


export const spellCheck = async (text, mode, mkt) => {

    const key = await _.getSecretValue('AZURE_SPELL_CHECK');

    const options = {
        method: 'post',
        url: `https://api.cognitive.microsoft.com/bing/v7.0/spellcheck/?mode=${mode || 'spell'}&mkt=${mkt || 'en-US'}`,
        headers: {
            'Ocp-Apim-Subscription-Key': key,
            'content-type': 'application/x-www-form-urlencoded',
            'X-ClientTraceId': v4()
        },
        data: qs.stringify({ text })
    };

    const result = await axios.request(options);
    const tokens = result.data.flaggedTokens;
    const fixes = [];
    var fixedText = text;
    var offsetAdjust = 0;
    _.each(tokens, (token) => {
        if (token.suggestions && token.suggestions.length > 0) {
            fixes.push(token.suggestions[0].suggestion);
            const offset = token.offset + offsetAdjust;
            fixedText = `${fixedText.substring(0, offset)}[PH.${fixes.length - 1}]${fixedText.substring(offset + token.token.length, text.length)}`;
            offsetAdjust = fixedText.length - text.length;
        }
    });

    for (var i = 0; i < fixes.length; i++) {
        fixedText = fixedText.replace(`[PH.${i}]`, fixes[i]);
    }

    return { suggestions: tokens, oriText: text, fixedText };

};