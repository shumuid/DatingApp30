using ADatingApp.API.Signers;
using DatingApp.API.Signers;
using DatingApp.API.Util;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using static System.Net.WebRequestMethods;

namespace DatingApp.API.AWS
{
    public static class ExecuteAWSRequests
    {
        /// <summary>
        /// Runs a http request to the specified endpoint
        /// </summary>
        /// <param name="endpointUri">
        /// "https://service.chime.aws.amazon.com/meetings"
        /// </param>
        /// <param name="requestType">
        /// "POST"
        /// </param>
        /// <param name="body">
        /// new { ClientRequestToken = "75341496-0878-440c-9db1-a7006c25a39f", MediaRegion = "us-east-1" }
        /// </param>
        /// <param name="service">
        /// // service = "chime"
        /// </param>
        /// <param name="region">
        /// "us-east-1"
        /// </param>
        /// <param name="queryParameters">
        /// ""
        /// </param>
        public static async Task<HttpWebResponse> Run(string endpointUri, string requestType, string service, string region, object body, string queryParameters)
        {
            var uri = new Uri(endpointUri);
            var headers = new Dictionary<string, string>();
            var authorization = string.Empty;
            string serializedBody = null;

            switch (requestType)
            {
                case Http.Post:
                    // precompute hash of the body content
                    serializedBody = JsonConvert.SerializeObject(body);
                    var contentHash = AWS4SignerBase.CanonicalRequestHashAlgorithm.ComputeHash(Encoding.UTF8.GetBytes(serializedBody));
                    var contentHashString = AWS4SignerBase.ToHexString(contentHash, true);

                    headers.Add(AWS4SignerBase.X_Amz_Content_SHA256, contentHashString);
                    headers.Add("content-length", serializedBody.Length.ToString());
                    headers.Add("content-type", "text/json");

                    var postSigner = new AWS4SignerForAuthorizationHeader
                    {
                        EndpointUri = uri,
                        HttpMethod = Http.Post,
                        Service = service,
                        Region = region
                    }; 

                    authorization = postSigner.ComputeSignature(headers, queryParameters, contentHashString, Settings.AWSAccessKey, Settings.AWSSecretKey);

                    // express authorization for this as a header
                    headers.Add("Authorization", authorization);

                    return await HttpHelpers.InvokeHttpRequest(uri, Http.Post, headers, serializedBody);

                case Http.Get:
                    headers.Add(AWS4SignerBase.X_Amz_Content_SHA256, Settings.EMPTY_BODY_SHA256);
                    headers.Add("content-type", "text/plain");

                    var getSigner = new AWS4SignerForQueryParameterAuth
                    {
                        EndpointUri = uri,
                        HttpMethod = Http.Get,
                        Service = service,
                        Region = region
                    };

                    authorization = getSigner.ComputeSignature(headers, queryParameters, Settings.EMPTY_BODY_SHA256, Settings.AWSAccessKey, Settings.AWSSecretKey);

                    var urlBuilder = new StringBuilder(endpointUri);
                    if(!string.IsNullOrEmpty(queryParameters))
                    {
                        urlBuilder.AppendFormat($"?{queryParameters}");
                        urlBuilder.AppendFormat($"&{authorization}");
                    }
                    else
                    {
                        urlBuilder.AppendFormat($"?{authorization}");
                    }

                    var presignedUrl = urlBuilder.ToString();

                    return await HttpHelpers.InvokeHttpRequest(new Uri(presignedUrl), Http.Get, headers, serializedBody);

                default: throw new Exception("Unknown request type");
            }
        }
    }
}
