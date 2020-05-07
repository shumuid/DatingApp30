using ADatingApp.API.Signers;
using DatingApp.API.Signers;
using DatingApp.API.Util;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Net;
using System.Text;
using System.Threading.Tasks;

namespace DatingApp.API.AWS
{
    public static class ExecuteAWSRequests
    {
        /// <summary>
        /// Runs a http request to the specified endpoint
        /// </summary>
        /// <param name="endpointUri">
        /// // endpointUri = "https://service.chime.aws.amazon.com/meetings"
        /// </param>
        /// <param name="requestType">
        /// //requestType = "POST"
        /// </param>
        /// <param name="body">
        /// // body = new { ClientRequestToken = "75341496-0878-440c-9db1-a7006c25a39f", MediaRegion = "us-east-1" }
        /// </param>
        /// <param name="service">
        /// // service = "chime"
        /// </param>
        /// <param name="region">
        /// // region = "us-east-1"
        /// </param>
        /// <param name="queryParameters">
        /// // queryParameters = ""
        /// </param>
        public static async Task<HttpWebResponse> Run(string endpointUri, string requestType, string service, string region, object body, string queryParameters)
        {
            var uri = new Uri(endpointUri);

            var signer = new AWS4SignerForAuthorizationHeader
            {
                EndpointUri = uri,
                HttpMethod = requestType,
                Service = service,
                Region = region
            };

            var headers = new Dictionary<string, string>();
            var authorization = string.Empty;
            string serializedBody = null;

            switch (requestType)
            {
                case "POST":
                    // precompute hash of the body content
                    serializedBody = JsonConvert.SerializeObject(body);
                    var contentHash = AWS4SignerBase.CanonicalRequestHashAlgorithm.ComputeHash(Encoding.UTF8.GetBytes(serializedBody));
                    var contentHashString = AWS4SignerBase.ToHexString(contentHash, true);

                    headers.Add(AWS4SignerBase.X_Amz_Content_SHA256, contentHashString);
                    headers.Add("content-length", serializedBody.Length.ToString());
                    headers.Add("content-type", "text/json");

                    authorization = signer.ComputeSignature(headers, queryParameters, contentHashString, Settings.AWSAccessKey, Settings.AWSSecretKey);
                    break;
                case "GET":
                    headers.Add(AWS4SignerBase.X_Amz_Content_SHA256, Settings.EMPTY_BODY_SHA256);
                    headers.Add("content-type", "text/plain");

                    authorization = signer.ComputeSignature(headers, queryParameters, Settings.EMPTY_BODY_SHA256, Settings.AWSAccessKey, Settings.AWSSecretKey);
                    break;
                default: throw new Exception("Unknown request type");
            }

            // express authorization for this as a header
            headers.Add("Authorization", authorization);

            // make the call to Amazon
            return await HttpHelpers.InvokeHttpRequest(uri, requestType, headers, serializedBody);
        }
    }
}
