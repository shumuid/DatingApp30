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
        private readonly IMeetingRepository _meetingRepo;

        public MeetingController(IChimeRepository chimeRepo, IMeetingRepository meetingRepo)
        {
            _chimeRepo = chimeRepo;
            _meetingRepo = meetingRepo;
        }

        [HttpPost("createMeeting")]
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

        //[HttpPost("joinMeeting/{mediaRegion}/{meetingTitle}/{attendeeName}")]
        [HttpPost("joinMeeting")]
        public async Task<IActionResult> JoinMeeting(string mediaRegion, string meetingTitle, string attendeeName)
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

            var attendee = new Value();
            attendee.AttendeeId = new Guid(attendeeResponse.Attendee.AttendeeId);
            attendee.Name = attendeeName;
            _meetingRepo.Add(attendee);
            await _meetingRepo.SaveAll();

            return Ok(new { JoinInfo = new JoinInfo() { Meeting = meetingResponse.Meeting, Attendee = attendeeResponse.Attendee, Title = meetingTitle } });
        }

        [HttpPost("logs")]
        public async Task<IActionResult> Logs()
        {
            return Ok("Successfully logged something");
        }

        //[HttpGet("getAttendee/{meetingId}/{attendeeId}/{name}")]
        //public async Task<IActionResult> GetAttendee(string meetingId, string attendeeId, string name)
        //[HttpGet("getAttendee/{attendeeId}")]
        [HttpGet("getAttendee")]
        public async Task<IActionResult> GetAttendee(string attendeeId)
        {
            //var objectToReturn = new { AttendeeInfo = await _chimeRepo.GetAttendee(meetingId, attendeeId), AttendeeName = name };
            //return Ok(objectToReturn);
            var attendee = await _meetingRepo.GetAttendee(new Guid(attendeeId));

            return Ok(new { attendeeName = attendee.Name });
        }
    }
}