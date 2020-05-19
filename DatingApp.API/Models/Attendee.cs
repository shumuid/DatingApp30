using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DatingApp.API.Models
{
    public class Attendee
    {
        public string AttendeeId { get; set; }
        public string ExternalUserId { get; set; }
        public string JoinToken { get; set; }
    }
}
