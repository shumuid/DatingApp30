using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DatingApp.API.AWS;
using DatingApp.API.Models;
using DatingApp.API.Util;
using Newtonsoft.Json;
using static System.Net.WebRequestMethods;

namespace DatingApp.API.Data
{
    public class ChimeRepository : IChimeRepository
    {
        public async Task<AttendeeDto> CreateAttendee<T>(T requestBody, string meetingId) where T : class
        {
            var awsResponsePOST = await ExecuteAWSRequests.Run($"{Settings.ChimeBaseUrl}/meetings/{meetingId}/attendees", Http.Post, "chime", "us-east-1", requestBody, string.Empty);
            var responseBodyPOST = await HttpHelpers.ReadResponseBody(awsResponsePOST);
            return JsonConvert.DeserializeObject<AttendeeDto>(responseBodyPOST);
        }

        public async Task<MeetingDto> CreateMeeting<T>(T requestBody) where T : class
        {
            var awsResponsePOST = await ExecuteAWSRequests.Run($"{Settings.ChimeBaseUrl}/meetings", Http.Post, "chime", "us-east-1", requestBody, string.Empty);
            var responseBodyPOST = await HttpHelpers.ReadResponseBody(awsResponsePOST);
            return JsonConvert.DeserializeObject<MeetingDto>(responseBodyPOST);
        }
    }
}
