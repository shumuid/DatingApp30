using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Runtime.Serialization.Json;
using System.Threading.Tasks;
using DatingApp.API.AWS;
using DatingApp.API.Data;
using DatingApp.API.Models;
using DatingApp.API.Util;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nancy.Json;
using Newtonsoft.Json;
using static System.Net.WebRequestMethods;

namespace DatingApp.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ValuesController : ControllerBase
    {
        private readonly DataContext _context;
        private readonly IChimeRepository _chimeRepo;
        public ValuesController(DataContext context, IChimeRepository chimeRepo)
        {
            _context = context;
            _chimeRepo = chimeRepo;
        }

        // GET api/values
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var reqMeetingBody = new { ClientRequestToken = Guid.NewGuid(), MediaRegion = "us-east-1" };
            var meetingResponse = await _chimeRepo.CreateMeeting(reqMeetingBody);

            var responseMeetingBodyPOST = JsonConvert.SerializeObject(meetingResponse);

            var reqAttendeeBody = new { ExternalUserId = Guid.NewGuid() };
            var attendeeResponse = await _chimeRepo.CreateAttendee(reqAttendeeBody, meetingResponse.Meeting.MeetingId);

            var attendeeResponsePOST = JsonConvert.SerializeObject(attendeeResponse);

            var awsResponseGET = await ExecuteAWSRequests.Run("https://service.chime.aws.amazon.com/meetings", Http.Get, "chime", "us-east-1", null, "max-results=99&next-token=2");
            var responseBodyGET = await HttpHelpers.ReadResponseBody(awsResponseGET);


            return Ok($"Response create meeting Body POST: \n\n {responseMeetingBodyPOST}\n\n Response create attendee Body POST: \n\n {attendeeResponsePOST}\n\n Response Body GET:\n\n {responseBodyGET}");
        }

        // GET api/values/5
        [HttpGet("{id}")]
        public async Task<IActionResult> GetValue(int id)
        {
            var value = await _context.Values.FirstOrDefaultAsync(x => x.Id == id);

            return Ok(value);
        }

        // POST api/values
        [HttpPost]
        public void Post([FromBody] string value)
        {
        }

        // PUT api/values/5
        [HttpPut("{id}")]
        public void Put(int id, [FromBody] string value)
        {
        }

        // DELETE api/values/5
        [HttpDelete("{id}")]
        public void Delete(int id)
        {
        }
    }
}
