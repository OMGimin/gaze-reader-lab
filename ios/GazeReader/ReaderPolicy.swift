import Foundation

/// Deliberately excludes login, purchase and arbitrary browsing. No camera data is passed to web content.
enum ReaderPolicy {
    static let hosts: Set<String> = ["comic.naver.com", "m.comic.naver.com"]
    static func allows(_ url: URL) -> Bool {
        guard url.scheme == "https", let host = url.host?.lowercased(), hosts.contains(host),
              url.user == nil, url.password == nil, url.port == nil || url.port == 443 else { return false }
        return url.path == "/webtoon" || url.path.hasPrefix("/webtoon/")
    }
    static func isEpisode(_ url: URL?) -> Bool {
        guard let url, allows(url) else { return false }
        return url.path == "/webtoon/detail"
    }
}
