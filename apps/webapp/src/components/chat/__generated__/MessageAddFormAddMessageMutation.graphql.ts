/**
 * @generated SignedSource<<c703f747a76fc97dc2c7a835da1b3523>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type NewMessageInput = {
  author?: string | null | undefined;
  body: string;
};
export type MessageAddFormAddMessageMutation$variables = {
  input: NewMessageInput;
};
export type MessageAddFormAddMessageMutation$data = {
  readonly addMessage: {
    readonly author: string | null | undefined;
    readonly body: string;
    readonly id: string;
  };
};
export type MessageAddFormAddMessageMutation = {
  response: MessageAddFormAddMessageMutation$data;
  variables: MessageAddFormAddMessageMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "newMessageData",
        "variableName": "input"
      }
    ],
    "concreteType": "Message",
    "kind": "LinkedField",
    "name": "addMessage",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "author",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "body",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "MessageAddFormAddMessageMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "MessageAddFormAddMessageMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "fb020c5045c592ddb9224df9bb778703",
    "id": null,
    "metadata": {},
    "name": "MessageAddFormAddMessageMutation",
    "operationKind": "mutation",
    "text": "mutation MessageAddFormAddMessageMutation(\n  $input: NewMessageInput!\n) {\n  addMessage(newMessageData: $input) {\n    id\n    author\n    body\n  }\n}\n"
  }
};
})();

(node as any).hash = "475659e29bc3bfce9bb3b885d7cfeb5b";

export default node;
