// Mock de @aws-sdk/lib-dynamodb para tests

export const DynamoDBDocumentClient = {
    from: () => ({}),
};

export class GetCommand {}
export class PutCommand {}
export class UpdateCommand {}
export class DeleteCommand {}
export class QueryCommand {}
export class ScanCommand {}
