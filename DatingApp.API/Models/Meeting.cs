using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DatingApp.API.Models
{
    public class Meeting
    {
        public string ExternalMeetingId { get; set; }
        public MediaPlacement MediaPlacement { get; set; }
        public string MediaRegion { get; set; }
        public string MeetingId { get; set; }
    }
}
