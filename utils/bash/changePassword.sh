source ../../.env

read -r -p "Username: " awsUserName
read -r -p "New password: " awsNewPassword

aws cognito-idp admin-set-user-password \
    --user-pool-id "${AWS_COGNITO_USER_POOL_ID}" \
    --username "${awsUserName}" \
    --password "${awsNewPassword}" \
    --permanent
