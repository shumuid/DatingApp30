using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DatingApp.API.Models
{
    public class MediaPlacement
    {
        public string AudioFallbackUrl { get; set; }
        public string AudioHostUrl { get; set; }
        public string ScreenDataUrl { get; set; }
        public string ScreenSharingUrl { get; set; }
        public string ScreenViewingUrl { get; set; }
        public string SignalingUrl { get; set; }
        public string TurnControlUrl { get; set; }
    }
}
