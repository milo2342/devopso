local playerSessions = {}

local function identifierByType(player, wanted)
    for _, identifier in ipairs(GetPlayerIdentifiers(player)) do
        if identifier:sub(1, #wanted + 1) == wanted .. ':' then
            return identifier:sub(#wanted + 2)
        end
    end
    return nil
end

local function verificationConfig()
    return GetConvar('wcrp_verification_secret', ''), GetConvar('wcrp_verification_url', ''), GetConvar('sv_hostname', 'WCRP FiveM')
end

local function apiRequest(endpoint, secret, payload, callback)
    payload.sentAt = os.time() * 1000
    payload.requestId = ('wcrp-%d-%06d-%s'):format(os.time(), math.random(0, 999999), tostring(payload.discordId or 'unknown'))
    PerformHttpRequest(endpoint, function(statusCode, body)
        if callback then callback(statusCode, body) end
    end, 'POST', json.encode(payload), {
        ['Content-Type'] = 'application/json',
        ['Authorization'] = 'Bearer ' .. secret
    })
end

local function reportConnection(player)
    local secret, endpoint, serverName = verificationConfig()
    if secret == '' or endpoint == '' then
        print('[WCRP Verification] Missing wcrp_verification_secret or wcrp_verification_url convar.')
        return
    end

    local discordId = identifierByType(player, 'discord')
    if not discordId then
        print(('[WCRP Verification] No Discord identifier available for player %s (%s).'):format(GetPlayerName(player) or 'Unknown', player))
        return
    end

    local session = {
        discordId = discordId,
        license = identifierByType(player, 'license') or '',
        serverName = serverName,
        playerName = GetPlayerName(player) or 'Unknown'
    }
    playerSessions[player] = session

    apiRequest(endpoint, secret, session, function(statusCode, body)
        if statusCode ~= 200 then
            print(('[WCRP Verification] API request failed for %s: HTTP %s %s'):format(discordId, statusCode, body or ''))
            return
        end
        local ok, response = pcall(json.decode, body or '{}')
        if not ok or not response then
            print(('[WCRP Verification] Invalid API response for %s.'):format(discordId))
            return
        end
        if response.verified then
            if response.alreadyVerified then
                print(('[WCRP Verification] %s is already verified; connection recorded without a new verification event.'):format(discordId))
            else
                print(('[WCRP Verification] %s verified successfully.'):format(discordId))
            end
        else
            print(('[WCRP Verification] %s connected but still requires Discord authorization.'):format(discordId))
        end
    end)
end

local function reportDisconnect(player, reason)
    local secret, endpoint, serverName = verificationConfig()
    if secret == '' or endpoint == '' then return end

    local session = playerSessions[player] or {
        discordId = identifierByType(player, 'discord'),
        license = identifierByType(player, 'license') or '',
        serverName = serverName,
        playerName = GetPlayerName(player) or 'Unknown'
    }
    playerSessions[player] = nil
    if not session.discordId then return end

    local disconnectEndpoint
    if endpoint:sub(-8) == '/connect' then
        disconnectEndpoint = endpoint:sub(1, -9) .. '/disconnect'
    else
        disconnectEndpoint = endpoint .. '/disconnect'
    end
    session.reason = tostring(reason or 'Disconnected')

    apiRequest(disconnectEndpoint, secret, session, function(statusCode, body)
        if statusCode ~= 200 then
            print(('[WCRP Verification] Disconnect API failed for %s: HTTP %s %s'):format(session.discordId, statusCode, body or ''))
        end
    end)
end

AddEventHandler('playerJoining', function()
    local player = source
    SetTimeout(1500, function()
        if GetPlayerName(player) then reportConnection(player) end
    end)
end)

AddEventHandler('playerDropped', function(reason)
    reportDisconnect(source, reason)
end)
