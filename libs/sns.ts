import { SNS } from 'aws-sdk';
import { isNil, isNumber } from 'lodash';
import {  _process,  _track } from 'douhub-helper-util';

export const getSNS = (region?: string) => {
    if (!region) region = _process.env.REGION;
    if (!region) region = 'us-east-1';

    if (isNil(_process._sns)) _process._sns = {};
    if (!_process._sns[region]) _process._sns[region] = new SNS({ region });
    return _process._sns[region];
}

export const snsPublish = async (topic: string, message: string, region?: string) => {
    try {
        await getSNS(region).publish({ Message: message, TopicArn: topic }).promise();
    }
    catch (error: any) {
        if (_track) console.error({ source: 'snsPublish', error, topic, message, region });
        throw error;
    }
};