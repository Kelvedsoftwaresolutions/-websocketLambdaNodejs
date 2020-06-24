"use strict";

const AWS = require("aws-sdk");
let dynamo = new AWS.DynamoDB.DocumentClient();

require("aws-sdk/clients/apigatewaymanagementapi");

const tablesName = {
  dev: "WebsocketDev",
  test: "WebsocketTest",
  prod: "WebsocketProd",
};

const successfullResponse = {
  statusCode: 200,
  body: "ok",
};

module.exports.connectionHandler = (event, context, callback) => {
  console.log(event);

  // If the token is valid

  if (event.requestContext.eventType === "CONNECT") {
    const queryParams = event.queryStringParameters;
    const userId = queryParams.userId;

    if (userId) {
      // Handle connection
      addConnection(
        event.requestContext.connectionId,
        tablesName[event.requestContext.stage],
        userId
      )
        .then(() => {
          callback(null, successfullResponse);
        })
        .catch((err) => {
          console.log(err);
          callback(null, JSON.stringify(err));
        });
    } else {
      console.log("Invalid Attempt");
      callback(null, successfullResponse);
    }
  } else if (event.requestContext.eventType === "DISCONNECT") {
    // Handle disconnection
    deleteConnection(
      event.requestContext.connectionId,
      tablesName[event.requestContext.stage]
    )
      .then(() => {
        callback(null, successfullResponse);
      })
      .catch((err) => {
        console.log(err);
        callback(null, {
          statusCode: 500,
          body: "Failed to connect: " + JSON.stringify(err),
        });
      });
  }
};

// Default handler
module.exports.defaultHandler = (event, context, callback) => {
  console.log("defaultHandler was called");
  console.log(event);

  // Should be diiferent
  if (event.data.type === "sendMessageToAllConnected") {
    sendMessageToAllConnected(event)
      .then(() => {
        callback(null, successfullResponse);
      })
      .catch((err) => {
        callback(null, JSON.stringify(err));
      });
  } else {
    callback(null, successfullResponse);
  }
};

const sendMessageToAllConnected = (event) => {
  return getConnectionIds().then((connectionData) => {
    return connectionData.Items.map((connectionId) => {
      return send(event, connectionId.connectionId);
    });
  });
};

const getConnectionIds = () => {
  const params = {
    TableName: CHATCONNECTION_TABLE,
    ProjectionExpression: "connectionId",
  };

  return dynamo.scan(params).promise();
};

const send = (event, connectionId) => {
  const body = JSON.parse(event.body);
  const postData = body.data;

  const endpoint =
    event.requestContext.domainName + "/" + event.requestContext.stage;
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint: endpoint,
  });

  const params = {
    ConnectionId: connectionId,
    Data: postData,
  };
  return apigwManagementApi.postToConnection(params).promise();
};

const addConnection = (connectionId, tableName, userId) => {
  const params = {
    TableName: tableName,
    Item: {
      connectionId: connectionId,
      userId: userId,
    },
  };

  return dynamo.put(params).promise();
};

const deleteConnection = (connectionId, tableName) => {
  const params = {
    TableName: tableName,
    Key: {
      connectionId: connectionId,
    },
  };

  return dynamo.delete(params).promise();
};
