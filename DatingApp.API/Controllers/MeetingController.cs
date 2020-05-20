﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DatingApp.API.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DatingApp.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MeetingController : ControllerBase
    {
        private readonly IChimeRepository _chimeRepo;

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
    }
}