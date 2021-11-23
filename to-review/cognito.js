
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


import _ from './base';

export const createUser = async (
    userPoolId,
    userPoolClientId,
    organizationId,
    userId,
    password,
    attributes
) => {
    if (!_.isArray(attributes)) attributes = [];
    return await createUserInternal(
        userPoolId,
        userPoolClientId,
        organizationId,
        userId,
        password,
        attributes
    );
};


export const createUserInternal = async (
    userPoolId,
    userPoolClientId,
    organizationId,
    userId,
    password,
    attributes
) => {
    const userName = `${organizationId}.${userId}`;

    let params = {
        UserPoolId: userPoolId,
        Username: userName,
        MessageAction: "SUPPRESS", // Do not send welcome email
        TemporaryPassword: password,
        UserAttributes: attributes,
    };

    return new Promise((resolve, reject) => {
        _.cognito
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
                return _.cognito.adminInitiateAuth(params).promise();
            })
            .then((data) => {
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
                    _.cognito.adminRespondToAuthChallenge(params).promise()
                );
            })
            .catch((error) => {
                reject(error);
            });
    });
};

export const deleteUser = async (userPoolId, organizationId, userId) => {
    const userName = `${organizationId}.${userId}`;

    const params = {
        UserPoolId: userPoolId,
        Username: userName,
    };
    return new Promise((resolve, reject) => {
        _.cognito.adminDeleteUser(params)
            .promise()
            .then(async () => {
                resolve();
            })
            .catch((error) => {
                reject(error);
            });
    });
};

//AWS Cognito does not support admin change password
//We does not need any attribute and features in Cognito,
//Before AWS API support it, we simply delete and receate a user with new password
export const updateUserPassword = async (userPoolId, userPoolClientId, organizationId, userId, password, attributes) => {
    await deleteUser(userPoolId, organizationId, userId);
    await createUserInternal(
        userPoolId,
        userPoolClientId,
        organizationId,
        userId,
        password,
        attributes
    );
};

export default {createUser, deleteUser};