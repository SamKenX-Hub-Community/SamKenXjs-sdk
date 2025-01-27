import { JsonSchemaValidator } from '../../src/schema-processor';
import { DIDDocumentJSONSchema } from '../../src/verifiable';
import chaiAsPromised from 'chai-as-promised';
import chai from 'chai';
chai.use(chaiAsPromised);
const { expect } = chai;

describe('json validator', () => {
  it('test validator validate', async () => {
    const jsonDIDDocument = `{"service":[{"id":"did:example:123#linked-domain","type":"LinkedDomains","serviceEndpoint":"https://bar.example.com"},{"id":"did:example:123#linked-domain","type":"push-notification","metadata":{"devices":[{"ciphertext":"base64encoded","alg":"rsa"}]},"serviceEndpoint":"https://bar.example.com"}],"id":"did:example:123#linked-domain"}`;
    const v = new JsonSchemaValidator();
    const jsonDIDDocumentBytes = new TextEncoder().encode(jsonDIDDocument);
    const dataBytes = new TextEncoder().encode(DIDDocumentJSONSchema);
    const result = await v.validate(jsonDIDDocumentBytes, dataBytes);
    expect(!!result).to.be.true;
  });

  it('test validator validateNoTypeInService', () => {
    // no type in did document service
    const jsonDIDDocument = `{"service":[{"id":"did:example:123#linked-domain","serviceEndpoint":"https://bar.example.com"},{"id":"did:example:123#linked-domain","type":"push-notification","metadata":{"devices":[{"ciphertext":"base64encoded","alg":"rsa"}]},"serviceEndpoint":"https://bar.example.com"}],"id":"did:example:123#linked-domain"}`;

    const v = new JsonSchemaValidator();
    const jsonDIDDocumentBytes = new TextEncoder().encode(jsonDIDDocument);
    const dataBytes = new TextEncoder().encode(DIDDocumentJSONSchema);
    expect(v.validate(jsonDIDDocumentBytes, dataBytes)).to.be.rejectedWith(
      "should have required property 'type'"
    );
  });

  it('test validator validateNoIDinDocument', () => {
    // no type in did document service
    const jsonDIDDocument = `{"service":[{"id":"did:example:123#linked-domain","type":"LinkedDomains","serviceEndpoint":"https://bar.example.com"},{"id":"did:example:123#linked-domain","type":"push-notification","metadata":{"devices":[{"ciphertext":"base64encoded","alg":"rsa"}]},"serviceEndpoint":"https://bar.example.com"}]}`;
    const v = new JsonSchemaValidator();
    const jsonDIDDocumentBytes = new TextEncoder().encode(jsonDIDDocument);
    const dataBytes = new TextEncoder().encode(DIDDocumentJSONSchema);
    expect(v.validate(jsonDIDDocumentBytes, dataBytes)).to.be.rejectedWith(
      "should have required property 'id'"
    );
  });
});
