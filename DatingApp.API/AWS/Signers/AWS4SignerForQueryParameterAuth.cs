using DatingApp.API.Util;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace DatingApp.API.Signers
{
    /// <summary>
    /// Sign requests to Amazon S3
    /// using query string parameters.
    /// </summary>
    public class AWS4SignerForQueryParameterAuth : AWS4SignerBase
    {
        public string ComputeSignature(IDictionary<string, string> headers,
                                       string queryParameters,
                                       string bodyHash,
                                       string awsAccessKey,
                                       string awsSecretKey)
        {
            // first get the date and time for the subsequent request, and convert to ISO 8601 format
            // for use in signature generation
            var requestDateTime = DateTime.UtcNow;
            var dateTimeStamp = requestDateTime.ToString(ISO8601BasicFormat, CultureInfo.InvariantCulture);

            // extract the host portion of the endpoint to include in the signature calculation,
            // unless already set
            if (!headers.ContainsKey("Host"))
            {
                var hostHeader = EndpointUri.Host;
                if (!EndpointUri.IsDefaultPort)
                    hostHeader += ":" + EndpointUri.Port;
                headers.Add("Host", hostHeader);
            }

            var dateStamp = requestDateTime.ToString(DateStringFormat, CultureInfo.InvariantCulture);
            var scope = $"{dateStamp}/{Region}/{Service}/{TERMINATOR}";

            // canonicalized headers need to be expressed in the query
            // parameters processed in the signature
            var canonicalizedHeaderNames = CanonicalizeHeaderNames(headers);
            var canonicalizedHeaders = CanonicalizeHeaders(headers);

            // reform the query parameters to (a) add the parameters required for
            // Signature V4 and (b) canonicalize the set before they go into the
            // signature calculation. Note that this assumes parameter names and 
            // values added outside this routine are already url encoded
            var paramDictionary = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (!string.IsNullOrEmpty(queryParameters))
            {
                paramDictionary = queryParameters.Split('&').Select(p => p.Split('='))
                                                     .ToDictionary(nameval => nameval[0],
                                                                   nameval => nameval.Length > 1
                                                                        ? nameval[1] : "");
            }

            // add the fixed authorization params required by Signature V4
            paramDictionary.Add(X_Amz_Algorithm, HttpHelpers.UrlEncode($"{SCHEME}-{ALGORITHM}"));
            paramDictionary.Add(X_Amz_Credential, HttpHelpers.UrlEncode($"{awsAccessKey}/{scope}"));
            paramDictionary.Add(X_Amz_SignedHeaders, HttpHelpers.UrlEncode(canonicalizedHeaderNames));

            // x-amz-date is now added as a query parameter, not a header, but still needs to be in ISO8601 basic form
            paramDictionary.Add(X_Amz_Date, HttpHelpers.UrlEncode(dateTimeStamp));

            // build the expanded canonical query parameter string that will go into the
            // signature computation
            var sb = new StringBuilder();
            var paramKeys = new List<string>(paramDictionary.Keys);
            paramKeys.Sort(StringComparer.Ordinal);
            foreach (var p in paramKeys)
            {
                if (sb.Length > 0)
                    sb.Append("&");
                sb.AppendFormat($"{p}={paramDictionary[p]}");
            }
            var canonicalizedQueryParameters = sb.ToString();

            // express all the header and query parameter data as a canonical request string
            var canonicalRequest = CanonicalizeRequest(EndpointUri,
                                                       HttpMethod,
                                                       canonicalizedQueryParameters,
                                                       canonicalizedHeaderNames,
                                                       canonicalizedHeaders,
                                                       bodyHash);

            byte[] canonicalRequestHashBytes 
                = CanonicalRequestHashAlgorithm.ComputeHash(Encoding.UTF8.GetBytes(canonicalRequest));

            // construct the string to be signed
            var stringToSign = new StringBuilder();

            stringToSign.AppendFormat($"{SCHEME}-{ALGORITHM}\n{dateTimeStamp}\n{scope}\n");
            stringToSign.Append(ToHexString(canonicalRequestHashBytes, true));

            // compute the multi-stage signing key
            KeyedHashAlgorithm kha = KeyedHashAlgorithm.Create(HMACSHA256);
            kha.Key = DeriveSigningKey(HMACSHA256, awsSecretKey, Region, dateStamp, Service);

            // compute the final signature for the request, place into the result and return to the 
            // user to be embedded in the request as needed
            var signature = kha.ComputeHash(Encoding.UTF8.GetBytes(stringToSign.ToString()));
            var signatureString = ToHexString(signature, true);

            // form up the authorization parameters for the caller to place in the query string
            var authString = new StringBuilder();
            var authParams = new string[]
                {
                    X_Amz_Algorithm, 
                    X_Amz_Credential, 
                    X_Amz_Date, 
                    X_Amz_SignedHeaders 
                };

            foreach (var p in authParams)
            {
                if (authString.Length > 0)
                    authString.Append("&");
                authString.AppendFormat($"{p}={paramDictionary[p]}");
            }

            authString.AppendFormat($"&{X_Amz_Signature}={signatureString}");

            var authorization = authString.ToString();

            return authorization;
        }
    }
}
