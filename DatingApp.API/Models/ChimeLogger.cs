using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DatingApp.API.Models
{
    public class ChimeLogger
    {
        public string MeetingId { get; set; }
        public string AttendeeId { get; set; }
        public string AppName { get; set; }
        public ChimeLogInfo[] Logs { get; set; }
    }
}
