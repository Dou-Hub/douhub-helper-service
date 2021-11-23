//  COPYRIGHT:       PrimeObjects Software Inc. (C) 2018 All Right Reserved
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

import _ from './base';
const twilio = require('twilio');
let twilioClient = null;

const initClient = async () => {
    if (!twilioClient) twilioClient = twilio(await _.getSecretValue('TWILIO_ACCOUNT_SID'), await _.getSecretValue('TWILIO_ACCOUNT_TOKEN'));
};

export const deleteSyncDocument = async (id) => {
    await initClient();
    const serviceId = await _.getSecretValue('TWILIO_SYNC_SERVICE_SID');
    return new Promise((resolve, reject) => {
        twilioClient.sync.services(serviceId)
            .documents(id)
            .remove()
            .then((document) => {
                resolve(document);
            })
            .catch((error) => {
                reject(error);
            });
    });
};

export const createSyncDocument = async (data) => {

    await initClient();
    const serviceId = await _.getSecretValue('TWILIO_SYNC_SERVICE_SID');
    const document = _.assign({ data }, { uniqueName: data.id }, _.isInteger(data.ttl) && data.ttl > 0 ? { ttl: data.ttl } : {});
    
    return new Promise((resolve, reject) => {
        twilioClient.sync.services(serviceId)
            .documents
            .create(document)
            .then((document) => {
                resolve(document);
            })
            .catch((error) => {
                reject(error);
            });
    });
};

export const retrieveSyncDocument = async (id) => {

    await initClient();
    const serviceId = await _.getSecretValue('TWILIO_SYNC_SERVICE_SID');
    
    return new Promise((resolve, reject) => {
        twilioClient.sync.services(serviceId)
            .documents(id)
            .fetch()
            .then((document) => {
                resolve(document);
            })
            .catch((error) => {
                console.error({error});
                resolve(null);
            });
    });
};

export const updateSyncDocument = async (data) => {

    await initClient();
    const serviceId = await _.getSecretValue('TWILIO_SYNC_SERVICE_SID');
    const document = _.assign({ data }, { uniqueName: data.id }, _.isInteger(data.ttl) && data.ttl > 0 ? { ttl: data.ttl } : {});
   
    return new Promise((resolve, reject) => {
        twilioClient.sync.services(serviceId)
            .documents(data.id)
            .update(document)
            .then((document) => {
                resolve(document);
            })
            .catch((error) => {
                reject(error);
            });
    });
};

export const upsertSyncDocument = async (data) => {

    if (await retrieveSyncDocument(data.id)) {
        return await updateSyncDocument(data);
    }
    else {
        return await createSyncDocument(data);
    }
};

export default {retrieveSyncDocument, updateSyncDocument, createSyncDocument, upsertSyncDocument};