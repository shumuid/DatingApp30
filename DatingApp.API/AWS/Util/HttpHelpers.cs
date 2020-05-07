﻿using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading.Tasks;

namespace DatingApp.API.Util
{
    public static class HttpHelpers
    {
        /// <summary>
        /// Makes a http request to the specified endpoint
        /// </summary>
        /// <param name="endpointUri"></param>
        /// <param name="httpMethod"></param>
        /// <param name="headers"></param>
        /// <param name="requestBody"></param>
        public static async Task<HttpWebResponse> InvokeHttpRequest(Uri endpointUri,
                                             string httpMethod,
                                             IDictionary<string, string> headers,
                                             string requestBody)
        {
            try
            {
                var request = ConstructWebRequest(endpointUri, httpMethod, headers);

                if (!string.IsNullOrEmpty(requestBody))
                {
                    var buffer = new byte[8192]; // arbitrary buffer size                        
                    var requestStream = await request.GetRequestStreamAsync();

                    using (var inputStream = new MemoryStream(Encoding.UTF8.GetBytes(requestBody)))
                    {
                        var bytesRead = 0;
                        while ((bytesRead = inputStream.Read(buffer, 0, buffer.Length)) > 0)
                        {
                            requestStream.Write(buffer, 0, bytesRead);
                        }
                    }
                }

                var response = await request.GetResponseAsync();

                return (HttpWebResponse)response;
            }
            catch (WebException ex)
            {
                using (var response = ex.Response as HttpWebResponse)
                {
                    if (response != null)
                    {
                        var errorMsg = ReadResponseBody(response);
                        throw new Exception($"HTTP call failed with exception '{errorMsg}', status code '{response.StatusCode}'");
                    }
                }
            }

            return null;
        }

        private static HttpWebRequest ConstructWebRequest(Uri endpointUri,
                                                         string httpMethod,
                                                         IDictionary<string, string> headers)
        {
            var request = (HttpWebRequest)WebRequest.Create(endpointUri);
            request.Method = httpMethod;

            foreach (var header in headers.Keys)
            {
                // not all headers can be set via the dictionary
                if (header.Equals("host", StringComparison.OrdinalIgnoreCase))
                    request.Host = headers[header];
                else if (header.Equals("content-length", StringComparison.OrdinalIgnoreCase))
                    request.ContentLength = long.Parse(headers[header]);
                else if (header.Equals("content-type", StringComparison.OrdinalIgnoreCase))
                    request.ContentType = headers[header];
                else
                    request.Headers.Add(header, headers[header]);
            }

            return request;
        }

        public static async Task<string> ReadResponseBody(HttpWebResponse response)
        {
            if (response == null)
                throw new ArgumentNullException("response", "Value cannot be null");

            // Then, open up a reader to the response and read the contents to a string
            // and return that to the caller.
            string responseBody = string.Empty;
            using (var responseStream = response.GetResponseStream())
            {
                if (responseStream != null)
                {
                    using (var reader = new StreamReader(responseStream))
                    {
                        responseBody = await reader.ReadToEndAsync();
                    }
                }
            }
            return responseBody;
        }

        public static string UrlEncode(string data, bool isPath = false)
        {
            // The Set of accepted and valid Url characters per RFC3986. Characters outside of this set will be encoded.
            const string validUrlCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.~";

            var encoded = new StringBuilder(data.Length * 2);
            string unreservedChars = String.Concat(validUrlCharacters, (isPath ? "/:" : ""));

            foreach (char symbol in System.Text.Encoding.UTF8.GetBytes(data))
            {
                if (unreservedChars.IndexOf(symbol) != -1)
                    encoded.Append(symbol);
                else
                    encoded.Append("%").Append(String.Format("{0:X2}", (int)symbol));
            }

            return encoded.ToString();
        }  

        //public static void CheckResponse(HttpWebRequest request)
        //{
        //    // Get the response and read any body into a string, then display.
        //    using (var response = (HttpWebResponse)request.GetResponse())
        //    {
        //        if (response.StatusCode == HttpStatusCode.Created)
        //        {
        //            Console.WriteLine("HTTP call succeeded");
        //            var responseBody = ReadResponseBody(response);
        //            if (!string.IsNullOrEmpty(responseBody))
        //            {
        //                Console.WriteLine("Response body:");
        //                Console.WriteLine(responseBody);
        //            }
        //        }
        //        else
        //            Console.WriteLine("HTTP call failed, status code: {0}", response.StatusCode);
        //    }
        //}
    }
}
