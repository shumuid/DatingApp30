using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DatingApp.API.Data;
using DatingApp.API.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DatingApp.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MeetingController : ControllerBase
    {
        private readonly IChimeRepository _chimeRepo;

        const string MeetingId = "_MeetingId";

        public MeetingController(IChimeRepository chimeRepo)
        {
            _chimeRepo = chimeRepo;
        }

        [HttpPost("createMeeting/{mediaRegion}")]
        public async Task<IActionResult> CreateMeeting(string mediaRegion)
        {
            var reqMeetingBody = new { ClientRequestToken = Guid.NewGuid(), MediaRegion = mediaRegion };
 
            return Ok(await _chimeRepo.CreateMeeting(reqMeetingBody));
        }

        [HttpPost("createAttendee/{meetingId}")]
        public async Task<IActionResult> CreateAttendee(string meetingId)
        {
            var reqAttendeeBody = new { ExternalUserId = Guid.NewGuid() };

            return Ok(await _chimeRepo.CreateAttendee(reqAttendeeBody, meetingId));
        }

        [HttpPost("joinMeeting/{mediaRegion}/{meetingTitle}")]
        public async Task<IActionResult> JoinMeeting(string mediaRegion, string meetingTitle)
        {
            MeetingDto meetingResponse;
            // to do remove this later, for now save meetingId in session so it won't create a meeting every time an attendee joins an existing meeting
            if (!Guid.TryParse(meetingTitle, out var newGuid))
            {
                var reqMeetingBody = new { ClientRequestToken = Guid.NewGuid(), MediaRegion = mediaRegion };

                meetingResponse = await _chimeRepo.CreateMeeting(reqMeetingBody);
            }
            else
            {
                meetingResponse = await _chimeRepo.GetMeeting(newGuid.ToString());
            }

            var reqAttendeeBody = new { ExternalUserId = Guid.NewGuid() };

            var attendeeResponse = await _chimeRepo.CreateAttendee(reqAttendeeBody, meetingResponse.Meeting.MeetingId);

            return Ok(new { JoinInfo = new JoinInfo() { Meeting = meetingResponse.Meeting, Attendee = attendeeResponse.Attendee, Title = meetingTitle } });
        }

        [HttpGet("getAttendee/{meetingId}/{attendeeId}/{name}")]
        public async Task<IActionResult> GetAttendee(string meetingId, string attendeeId, string name)
        {
            var objectToReturn = new { AttendeeInfo = await _chimeRepo.GetAttendee(meetingId, attendeeId), AttendeeName = name };
            return Ok(objectToReturn);
        }
    }
}