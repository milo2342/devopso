local function identifierByType(player, wanted)
    for _, identifier in ipairs(GetPlayerIdentifiers(player)) do
        if identifier:sub(1, #wanted + 1) == wanted .. ':' then
            return identifier:sub(#wanted + 2)
        end
    end
    return nil
end

local function reportConnection(player)
    local secret = GetConvar('wcrp_verification_secret', '')
    local endpoint = GetConvar('wcrp_verification_url', '')
    local serverName = GetConvar('sv_hostname', 'WCRP FiveM')

    if secret == '' or endpoint == '' then
        print('[WCRP Verification] Missing wcrp_verification_secret or wcrp_verification_url convar.')
        return
    end

    local discordId = identifierByType(player, 'discord')
    if not discordId then
        print(('[WCRP Verification] No Discord identifier available for player %s (%s).'):format(GetPlayerName(player) or 'Unknown', player))
        return
    end

    local payload = json.encode({
        discordId = discordId,
        license = identifierByType(player, 'license') or '',
        serverName = serverName,
        playerName = GetPlayerName(player) or 'Unknown'
    })

    PerformHttpRequest(endpoint, function(statusCode, body)
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
            print(('[WCRP Verification] %s verified successfully.'):format(discordId))
        else
            print(('[WCRP Verification] %s connected but still requires Discord authorization.'):format(discordId))
        end
    end, 'POST', payload, {
        ['Content-Type'] = 'application/json',
        ['Authorization'] = 'Bearer ' .. secret
    })
end

AddEventHandler('playerJoining', function()
    local player = source
    SetTimeout(1500, function()
        if GetPlayerName(player) then reportConnection(player) end
    end)
end)
