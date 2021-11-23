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

export const deleteSyncList = async (id) => {
    await initClient();
    const serviceId = await _.getSecretValue('TWILIO_SYNC_SERVICE_SID');
    return new Promise((resolve, reject) => {
        twilioClient.sync.services(serviceId)
            .syncLists(id)
            .remove()
            .then((list) => {
                resolve(list);
            })
            .catch((error) => {
                reject(error);
            });
    });
};

export const createSyncList = async (data) => {

    await initClient();
    const serviceId = await _.getSecretValue('TWILIO_SYNC_SERVICE_SID');
    const list = _.assign({ data }, { uniqueName: data.id }, _.isInteger(data.ttl) && data.ttl > 0 ? { ttl: data.ttl } : {});
    
    return new Promise((resolve, reject) => {
        twilioClient.sync.services(serviceId)
            .syncLists
            .create(list)
            .then((list) => {
                resolve(list);
            })
            .catch((error) => {
                reject(error);
            });
    });
};

export const retrieveSyncList = async (id) => {

    await initClient();
    const serviceId = await _.getSecretValue('TWILIO_SYNC_SERVICE_SID');
    
    return new Promise((resolve, reject) => {
        twilioClient.sync.services(serviceId)
            .syncLists(id)
            .fetch()
            .then((list) => {
                resolve(list);
            })
            .catch((error) => {
                console.log({error});
                resolve(null);
            });
    });
};

export const updateSyncList = async (data) => {

    await initClient();
    
    const serviceId = await _.getSecretValue('TWILIO_SYNC_SERVICE_SID');
    const list = _.assign({ data }, { uniqueName: data.id }, _.isInteger(data.ttl) && data.ttl > 0 ? { ttl: data.ttl } : {});
   
    return new Promise((resolve, reject) => {
        twilioClient.sync.services(serviceId)
            .syncLists(data.id)
            .update(list)
            .then((list) => {
                resolve(list);
            })
            .catch((error) => {
                reject(error);
            });
    });
};

export const upsertSyncList = async (data) => {

    if (await retrieveSyncList(data.id)) {
        return await updateSyncList(data);
    }
    else {
        return await createSyncList(data);
    }
};

export const createSyncListItem = async (data) => {

    await initClient();
    const serviceId = await _.getSecretValue('TWILIO_SYNC_SERVICE_SID');

    const listId = data.listId;
    if (!listId) throw 'data.listId is required.';

    const item = _.assign({ data }, _.isInteger(data.ttl) && data.ttl > 0 ? { ttl: data.ttl } : {});
   
    return new Promise((resolve, reject) => {
        twilioClient.sync.services(serviceId)
            .syncLists(listId)
            .syncListItems
            .create(item)
            .then((list) => {
                resolve(list);
            })
            .catch((error) => {
                reject(error);
            });
    });
};

export const updateSyncListItem = async (data) => {

    await initClient();
    const serviceId = await _.getSecretValue('TWILIO_SYNC_SERVICE_SID');
    const listId = data.listId;
    if (!listId) throw 'data.listId is required.';

    const index = data.index;
    if (!index) throw 'data.index is required.';

    const item = _.assign({ data }, _.isInteger(data.ttl) && data.ttl > 0 ? { ttl: data.ttl } : {});
 
    return new Promise((resolve, reject) => {
        twilioClient.sync.services(serviceId)
            .syncLists(listId)
            .syncListItems(index)
            .update(item)
            .then((list) => {
                resolve(list);
            })
            .catch((error) => {
                reject(error);
            });
    });
};

export const deleteSyncListItem = async (data) => {

    await initClient();
    const serviceId = await _.getSecretValue('TWILIO_SYNC_SERVICE_SID');

    const listId = data.listId;
    if (!listId) throw 'data.listId is required.';

    const index = data.index;
    if (!index) throw 'data.index is required.';
   
   
    return new Promise((resolve, reject) => {
        twilioClient.sync.services(serviceId)
            .syncLists(listId)
            .syncListItems(index)
            .remove()
            .then((list) => {
                resolve(list);
            })
            .catch((error) => {
                reject(error);
            });
    });
};

export default {
    retrieveSyncList, updateSyncList, createSyncList, upsertSyncList,
    createSyncListItem, updateSyncListItem, deleteSyncListItem
};