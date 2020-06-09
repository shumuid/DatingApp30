using DatingApp.API.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DatingApp.API.Data
{
    public interface IChimeRepository
    {
        Task<MeetingDto> CreateMeeting<T>(T requestBody) where T : class;
        Task<AttendeeDto> CreateAttendee<T>(T requestBody, string meetingId) where T : class;
        Task<AttendeeDto> GetAttendee(string meetingId, string attendeeId);
        Task<MeetingDto> GetMeeting(string meetingId);
    }
}
