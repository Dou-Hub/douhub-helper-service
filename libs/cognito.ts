//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.

import { _process } from 'douhub-helper-util';
import { CognitoIdentityServiceProvider } from 'aws-sdk';
import { isArray } from 'lodash';

export const getCognito = (region?: string) => {

    if (!region) region = _process.env.REGION;
    if (!region) region = 'us-east-1';

    if (!_process._cognito) _process._cognito = {};
    if (!_process._cognito[region]) _process._cognito[region] = new CognitoIdentityServiceProvider({ region });
    return _process._cognito[region];
}

export const createCognitoUser = async (
    userPoolId: string,
    userPoolClientId: string,
    organizationId: string,
    userId: string,
    password: string,
    attributes?: string[],
    region?: string
) => {
    if (!isArray(attributes)) attributes = [];
    return await createCognitoUserInternal(
        userPoolId,
        userPoolClientId,
        organizationId,
        userId,
        password,
        attributes,
        region
    );
};


export const createCognitoUserInternal = async (
    userPoolId: string,
    userPoolClientId: string,
    organizationId: string,
    userId: string,
    password: string,
    attributes: string[],
    region?: string
) => {
    const userName = `${organizationId}.${userId}`;

    let params = {
        UserPoolId: userPoolId,
        Username: userName,
        MessageAction: "SUPPRESS", // Do not send welcome email
        TemporaryPassword: password,
        UserAttributes: attributes,
    };

    const cognito = getCognito(region);

    return new Promise((resolve, reject) => {
        cognito(region)
            .adminCreateUser(params)
            .promise()
            .then(() => {
                // We created the user above, but the password is marked as temporary.
                // We need to set the password again. Initiate an auth challenge to get
                // started.
                let params = {
                    AuthFlow: "ADMIN_NO_SRP_AUTH",
                    ClientId: userPoolClientId, // From Cognito dashboard, generated app client id
                    UserPoolId: userPoolId,
                    AuthParameters: {
                        USERNAME: userName,
                        PASSWORD: password,
                    },
                };
                return cognito.adminInitiateAuth(params).promise();
            })
            .then((data: Record<string, any>) => {
                // We now have a proper challenge, set the password permanently.
                let challengeResponseData = {
                    USERNAME: userName,
                    NEW_PASSWORD: password,
                };

                let params = {
                    ChallengeName: "NEW_PASSWORD_REQUIRED",
                    ClientId: userPoolClientId,
                    UserPoolId: userPoolId,
                    ChallengeResponses: challengeResponseData,
                    Session: data.Session,
                };
                resolve(
                    cognito.adminRespondToAuthChallenge(params).promise()
                );
            })
            .catch((error: any) => {
                reject(error);
            });
    });
};

export const deleteCognitoUser = async (
    userPoolId: string,
    organizationId: string,
    userId: string,
    region?: string) => {
    const userName = `${organizationId}.${userId}`;

    const params = {
        UserPoolId: userPoolId,
        Username: userName,
    };
    return new Promise((resolve, reject) => {
        getCognito(region).adminDeleteUser(params)
            .promise()
            .then((data: any) => {
                resolve(data);
            })
            .catch((error: any) => {
                reject(error);
            });
    });
};

//AWS Cognito does not support admin change password
//We does not need any attribute and features in Cognito,
//Before AWS API support it, we simply delete and receate a user with new password
 export const updateCognitoPassword = async (
    userPoolId: string,
    userPoolClientId: string,
    organizationId: string,
    userId: string,
    password: string,
    attributes: string[],
    region?: string) => {
    await deleteCognitoUser(userPoolId, organizationId, userId);
    await createCognitoUser(
        userPoolId,
        userPoolClientId,
        organizationId,
        userId,
        password,
        attributes,
        region
    );
};
