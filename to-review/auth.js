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
import axios from 'axios';

export const verifyReCaptchaToken = async (siteKey, token) => 
{
    try {

        const googleApiKey = await _.getSecretValue('GOOGLE_RECAPTCHA_KEY');
        const googleProjectId = await _.getSecretValue('GOOGLE_PROJECT_ID');

        const options = {
            method: 'post',
            url: `https://recaptchaenterprise.googleapis.com/v1beta1/projects/${googleProjectId}/assessments?key=${googleApiKey}`,
            data: { event: { token, siteKey } }
        };

        return (await axios.request(options)).data;

    }
    catch (error) {
        console.error(error);
    }

    return null;
};