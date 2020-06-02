using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DatingApp.API.Models
{
    public class JoinInfo
    {
        public Attendee Attendee { get; set; }
        public Meeting Meeting { get; set; }
        public string Title { get; set; }
    }
}
