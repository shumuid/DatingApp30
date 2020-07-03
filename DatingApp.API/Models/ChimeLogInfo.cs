using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DatingApp.API.Models
{
    public class ChimeLogInfo
    {
        public int SequenceNumber { get; set; }
        public string Message { get; set; }
        public int TimeStampMs { get; set; }
        public string LogLevel { get; set; }
    }
}
