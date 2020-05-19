using Microsoft.Extensions.Configuration;

namespace DatingApp.API
{
    internal static class Settings
    {
        public static string EMPTY_BODY_SHA256 { get; }
        public static string AWSAccessKey { get; }
        public static string AWSSecretKey { get; }
        public static string ChimeBaseUrl { get; }

        static Settings()
        {
            var awsConfig = new ConfigurationBuilder().AddJsonFile("aws.config.json").Build();

            EMPTY_BODY_SHA256 = awsConfig["EMPTY_BODY_SHA256"];
            AWSAccessKey = awsConfig["AWSAccessKey"];
            AWSSecretKey = awsConfig["AWSSecretKey"];
            ChimeBaseUrl = awsConfig["ChimeBaseUrl"];
        }
    }
}
